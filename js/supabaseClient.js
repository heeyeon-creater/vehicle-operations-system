import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nlfumdbjrzyzolnykbpi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aX9-2f_dLk28SVVSadyr1w_6Q8Wuj6S';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
