import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://yyhdysfqmemywhmxkuqh.supabase.co",
  "sb_publishable_QTtHq7o46IuOfXwtVhbbKg_Gs9mbwwt"
);

window.login = async function () {
  const email = document.getElementById("email").value;

  const { error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (!error) alert("Check your email");
};
