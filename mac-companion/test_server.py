import importlib.util, tempfile, unittest, uuid, json, threading, http.client
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('companion',Path(__file__).with_name('server.py'))
s=importlib.util.module_from_spec(spec); spec.loader.exec_module(s)
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(); s.STATE=Path(self.tmp.name); s.JOBS.clear(); s.initialize()
 def tearDown(self): self.tmp.cleanup()
 def test_sources_dates_and_segments(self):
  seg=s.read_segments({'transcription':[{'text':'Viet liefert am 03.11.2026 den Plan.','offsets':{'from':65000}}]})
  self.assertEqual(seg[0]['time'],'00:01:05')
  self.assertIsNotNone(s.evidence({'segmentId':'S1','evidence':'Viet liefert am 03.11.2026'},seg))
  self.assertIsNone(s.evidence({'segmentId':'S2','evidence':'Viet liefert'},seg))
  self.assertIsNone(s.evidence({'segmentId':'S1','evidence':'John übernimmt alles'},seg))
  self.assertEqual(s.explicit_date('2026-11-03','morgen'),'')
  self.assertEqual(s.explicit_date('2026-11-03',seg[0]['text']),'2026-11-03')
  rows=s.text_segments('A'*15000+'\nB'*9000)
  self.assertEqual(sum(len(g) for g in s.chunks(rows)),len(rows))
 def test_process_review_and_document_copy(self):
  jid=str(uuid.uuid4()); folder=s.job_dir(jid); folder.mkdir()
  job={'id':jid,'source':'text','title':'Projekt','date':'2026-11-01','documents':[],'createdAt':'now'}
  s.JOBS[jid]=job; (folder/'input.txt').write_text('Viet liefert den Plan am 03.11.2026.')
  response={'summary':'Plan wird geliefert.','todos':[{'title':'Plan liefern','assignee':'Viet','dueDate':'2026-11-03','segmentId':'S1','evidence':'Viet liefert den Plan am 03.11.2026.'},{'title':'Erfunden','segmentId':'S1','evidence':'John erledigt alles.'}]}
  with patch.object(s,'generate',return_value=response): s.process(jid)
  self.assertEqual(s.JOBS[jid]['status'],'done')
  result=json.loads((folder/'result.json').read_text()); self.assertEqual(len(result['todos']),1)
  doc=str(uuid.uuid4()); df=s.STATE/'documents'/doc; df.mkdir(); (df/'text.txt').write_text('Alter Termin')
  cid=str(uuid.uuid4()); result['documentChanges']=[{'id':cid,'documentId':doc,'before':'Alter Termin','after':'Neuer Termin'}]; s.atomic_json(folder/'result.json',result)
  task=result['todos'][0]
  reviewed=s.review_export(jid,{'todos':[{**task,'decision':'accepted','title':'Plan prüfen'},{'id':str(uuid.uuid4()),'decision':'accepted'}],'approvedChanges':[cid]})
  self.assertEqual(reviewed['result']['todos'][0]['title'],'Plan prüfen')
  self.assertEqual(reviewed['result']['todos'][0]['evidence'],task['evidence'])
  self.assertEqual((df/'text.txt').read_text(),'Alter Termin')
  self.assertEqual((folder/'revisions'/(doc+'.txt')).read_text(),'Neuer Termin')
 def test_http_boundary_and_export(self):
  srv=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler); threading.Thread(target=srv.serve_forever,daemon=True).start()
  def request(path,headers=None,method='GET',body=None):
   c=http.client.HTTPConnection('127.0.0.1',srv.server_port); c.request(method,path,body=body,headers=headers or {}); r=c.getresponse(); data=r.read(); c.close(); return r,data
  try:
   self.assertEqual(request('/api/jobs')[0].status,403)
   self.assertEqual(request('/',{'Host':'evil.example'})[0].status,403)
   root,_=request('/'); cookie=root.getheader('Set-Cookie').split(';')[0]
   auth={'Cookie':cookie}
   self.assertEqual(request('/api/jobs',auth)[0].status,200)
   self.assertEqual(request('/api/jobs',{**auth,'Origin':'https://evil.example'})[0].status,403)
   self.assertEqual(request('/api/jobs/text',auth,'POST','{}')[0].status,403)
   self.assertEqual(request('/../../etc/passwd',auth)[0].status,404)
   jid=str(uuid.uuid4()); folder=s.job_dir(jid); folder.mkdir(); s.atomic_json(folder/'review.json',{'ok':True})
   r,data=request('/api/jobs/'+jid+'/export',auth); self.assertEqual(r.status,200); self.assertEqual(json.loads(data),{'ok':True}); self.assertIn('attachment',r.getheader('Content-Disposition'))
  finally: srv.shutdown(); srv.server_close()
if __name__=='__main__': unittest.main()
