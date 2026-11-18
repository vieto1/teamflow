import {createClient} from '@supabase/supabase-js';
export const boardClient=createClient('https://bewbgijcyyckamhnomrd.supabase.co','sb_publishable_L_8uFsJnZ_Z85-99eqJmEQ_kKVkEnGA',{auth:{persistSession:false,autoRefreshToken:false}});
export type Board={id:string;title:string;created_at:string;updated_at:string};
export async function listBoards(){const {data,error}=await boardClient.from('exit_boards').select('*').order('updated_at',{ascending:false});if(error)throw error;return data as Board[]}
