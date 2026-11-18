-- Demo-only codes. Do not run this on production.
-- Local previews can apply it by hand after supabase/seed.sql.
insert into public.promo_codes (code,kind,value,expires_at,max_uses,used_count,active,note) values ('NAVIDAD10','percent',10,'2026-12-25T23:59:59-05:00',500,12,true,'10% de Navidad') on conflict (code) do nothing;
insert into public.promo_codes (code,kind,value,expires_at,max_uses,used_count,active,note) values ('MARCO20','fixed',2000,'2027-02-14T23:59:59-05:00',200,0,true,'S/ 20 de descuento') on conflict (code) do nothing;
insert into public.gift_cards (code,initial_cents,balance_cents,buyer_name,buyer_phone,recipient_name,recipient_phone,message,status) values ('HOLANAVIDAD',5000,5000,'Mi Fotito','51999999999','Invitado','51987654321','Para tu primer marco','active') on conflict (code) do nothing;
insert into public.referrals (code,owner_phone,owner_name,friend_discount_cents,referrer_credit_cents,redeemed_count) values ('AMIGO1500','51911111111','Ana',1500,1500,1) on conflict (code) do nothing;
insert into public.credits (phone,balance_cents) values ('51987654321',1500) on conflict (phone) do nothing;
