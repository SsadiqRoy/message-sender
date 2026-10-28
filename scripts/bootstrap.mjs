import {createClient} from '@supabase/supabase-js';
const email=process.argv[2];if(!email)throw Error('Usage: node --env-file=.env.local scripts/bootstrap.mjs email');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let user;for(let page=1;!user;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw error;user=data.users.find(u=>u.email===email);if(data.users.length<100)break;}
if(!user)throw Error('Create the user in Supabase Auth first, then rerun. Existing accounts are never modified.');
const {count}=await db.from('ms_members').select('*',{count:'exact',head:true}).eq('role','chief');if(count)throw Error('A chief admin already exists');
const {error}=await db.from('ms_members').insert({user_id:user.id,name:'Samuel Nigal',role:'chief'});if(error)throw error;console.log('Message Sender membership created.');
