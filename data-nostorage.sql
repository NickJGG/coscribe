SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict GSE365RMuy3ruPvLRca2hJmtplVUHD1a7uEmaxaPyMuJB9ZyTjtV0DCbv6UjRYa

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at", "custom_claims_allowlist") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
7760ce3d-0ca2-4fec-8266-3e6dc54d0299	caa640be-8fda-4c22-9212-b1dcbacdc7e2	320abbc1-6fe9-4f62-a8f5-ef9df45c2a62	s256	u0_Uei4o3qLV5eqWqGBQL5SNF1SYjondp63ijHwW94c	google	ya29.a0AX07Cmvt3A3EuShgnBfR5vksrYviK5OBUt6t7JVDECatXU4xz5OX_d17xap-L6LWsTl-dmH2aTA_du2djbhv3FuCj6_gZaTYtCHJY8Eki_ib2riZz51sxLWMN8QISB0hIYLhX0g0ltr2xa71QXRcVIaQT-_InmfRVncbh0O67048ipgvuQC5ZYzTrJUAJwnDIH3XiPbN-pamRsJaT02WRdDih4iFqYcy5ZgrL3d6hC9gNgb3qt26x6alzBsmckheMrRLxeHGQKfRkdWJOpjjhhV95FDfRQwaCgYKAVsSARcSFQHGX2MiyqITJUsOAB8TyinaKnChEg0294		2026-10-10 21:23:57.428649+00	2026-10-10 21:24:00.408614+00	oauth	2026-10-10 21:24:00.408547+00	\N	https://coscribe-ten.vercel.app	\N	\N	f
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	eba2b71b-1429-448a-939d-613baff9b23c	authenticated	authenticated	nick.gilliam3@gmail.com	\N	2026-10-10 21:34:09.655507+00	\N		\N		\N			\N	2026-10-10 21:34:09.91639+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "107997306416077518163", "name": "Nick Gilliam", "email": "nick.gilliam3@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKWUCqXsOOk0nyCaEbQ4vubB7vIC6prWUOzIWtkpi7EdRIWFg=s96-c", "full_name": "Nick Gilliam", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKWUCqXsOOk0nyCaEbQ4vubB7vIC6prWUOzIWtkpi7EdRIWFg=s96-c", "provider_id": "107997306416077518163", "email_verified": true, "phone_verified": false}	\N	2026-10-10 21:34:09.631066+00	2026-10-10 21:34:09.950158+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	caa640be-8fda-4c22-9212-b1dcbacdc7e2	authenticated	authenticated	nick.gilliam2@gmail.com	\N	2026-10-10 20:58:04.794574+00	\N		\N		\N			\N	2026-10-10 21:37:07.970932+00	{"provider": "google", "providers": ["google"]}	{"iss": "https://accounts.google.com", "sub": "117771651679706917240", "name": "Nick Gilliam", "email": "nick.gilliam2@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIbTIiIrqSQTjsKSJhy9JNRr0AicM0IuX2_IHnHbDZpf3QCxHBi=s96-c", "full_name": "Nick Gilliam", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIbTIiIrqSQTjsKSJhy9JNRr0AicM0IuX2_IHnHbDZpf3QCxHBi=s96-c", "provider_id": "117771651679706917240", "email_verified": true, "phone_verified": false}	\N	2026-10-10 20:58:04.767563+00	2026-10-10 21:37:07.981786+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
107997306416077518163	eba2b71b-1429-448a-939d-613baff9b23c	{"iss": "https://accounts.google.com", "sub": "107997306416077518163", "name": "Nick Gilliam", "email": "nick.gilliam3@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKWUCqXsOOk0nyCaEbQ4vubB7vIC6prWUOzIWtkpi7EdRIWFg=s96-c", "full_name": "Nick Gilliam", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKWUCqXsOOk0nyCaEbQ4vubB7vIC6prWUOzIWtkpi7EdRIWFg=s96-c", "provider_id": "107997306416077518163", "email_verified": true, "phone_verified": false}	google	2026-10-10 21:34:09.646915+00	2026-10-10 21:34:09.646969+00	2026-10-10 21:34:09.646969+00	5dba6ab4-10fc-46ae-84bf-1fd6e85f92c4
117771651679706917240	caa640be-8fda-4c22-9212-b1dcbacdc7e2	{"iss": "https://accounts.google.com", "sub": "117771651679706917240", "name": "Nick Gilliam", "email": "nick.gilliam2@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIbTIiIrqSQTjsKSJhy9JNRr0AicM0IuX2_IHnHbDZpf3QCxHBi=s96-c", "full_name": "Nick Gilliam", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIbTIiIrqSQTjsKSJhy9JNRr0AicM0IuX2_IHnHbDZpf3QCxHBi=s96-c", "provider_id": "117771651679706917240", "email_verified": true, "phone_verified": false}	google	2026-10-10 20:58:04.788305+00	2026-10-10 20:58:04.788358+00	2026-10-10 21:37:07.680899+00	6a90ce1d-e526-49cd-8753-ec12176eb750
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
d527afeb-d6c4-45fe-ad53-a6bda5f470e4	caa640be-8fda-4c22-9212-b1dcbacdc7e2	2026-10-10 20:58:05.323774+00	2026-10-10 20:58:05.323774+00	\N	aal1	\N	\N	node	54.237.213.146	\N	\N	\N	\N	\N
1e3247ef-5072-4dd7-819e-4127e34231ce	caa640be-8fda-4c22-9212-b1dcbacdc7e2	2026-10-10 21:31:51.679544+00	2026-10-10 21:31:51.679544+00	\N	aal1	\N	\N	node	44.222.129.39	\N	\N	\N	\N	\N
842c6812-b917-400a-9007-56117682fa76	eba2b71b-1429-448a-939d-613baff9b23c	2026-10-10 21:34:09.917493+00	2026-10-10 21:34:09.917493+00	\N	aal1	\N	\N	node	44.222.129.39	\N	\N	\N	\N	\N
27cf4df4-ba21-43de-ac44-d7f9e058049c	caa640be-8fda-4c22-9212-b1dcbacdc7e2	2026-10-10 21:37:07.972034+00	2026-10-10 21:37:07.972034+00	\N	aal1	\N	\N	node	44.222.129.39	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
d527afeb-d6c4-45fe-ad53-a6bda5f470e4	2026-10-10 20:58:05.351174+00	2026-10-10 20:58:05.351174+00	oauth	500cc7f0-06f9-4e0b-838d-f8f555498509
1e3247ef-5072-4dd7-819e-4127e34231ce	2026-10-10 21:31:51.71388+00	2026-10-10 21:31:51.71388+00	oauth	d24f8628-5a4c-410a-baf1-28957e03ea57
842c6812-b917-400a-9007-56117682fa76	2026-10-10 21:34:09.950978+00	2026-10-10 21:34:09.950978+00	oauth	145f2e2d-660d-4285-a5c0-01373f9d947a
27cf4df4-ba21-43de-ac44-d7f9e058049c	2026-10-10 21:37:07.98359+00	2026-10-10 21:37:07.98359+00	oauth	f984dd9a-26f0-4b3f-805f-f3a21bf30b7e
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_code_sets" ("id", "user_id", "mfa_factor_id", "failed_verification_count", "verification_locked_until", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_codes" ("id", "mfa_recovery_code_set_id", "code_hash", "consumed_at", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	1	vanpx5gqwzfd	caa640be-8fda-4c22-9212-b1dcbacdc7e2	f	2026-10-10 20:58:05.3325+00	2026-10-10 20:58:05.3325+00	\N	d527afeb-d6c4-45fe-ad53-a6bda5f470e4
00000000-0000-0000-0000-000000000000	2	2jzbaonpv2hr	caa640be-8fda-4c22-9212-b1dcbacdc7e2	f	2026-10-10 21:31:51.688703+00	2026-10-10 21:31:51.688703+00	\N	1e3247ef-5072-4dd7-819e-4127e34231ce
00000000-0000-0000-0000-000000000000	3	bycuevtk7cre	eba2b71b-1429-448a-939d-613baff9b23c	f	2026-10-10 21:34:09.934385+00	2026-10-10 21:34:09.934385+00	\N	842c6812-b917-400a-9007-56117682fa76
00000000-0000-0000-0000-000000000000	4	4dujvna77rsb	caa640be-8fda-4c22-9212-b1dcbacdc7e2	f	2026-10-10 21:37:07.977875+00	2026-10-10 21:37:07.977875+00	\N	27cf4df4-ba21-43de-ac44-d7f9e058049c
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_tokens" ("id", "sso_provider_id", "token_hash", "prefix", "created_at", "expires_at", "revoked_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_users" ("id", "sso_provider_id", "user_id", "resource", "created_at", "updated_at", "deleted_at") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: stories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."stories" ("id", "title", "visibility", "status", "created_at", "finished_at", "hidden_from_front", "blurb") FROM stdin;
e6b0f062-29a8-4847-b0ed-0646bdd01516	Two's Complement	private	active	2026-10-10 20:58:22.324659+00	\N	f	\N
fc9701a1-dbfd-40b3-a4c4-2a509052b072	Test	private	active	2026-10-10 21:33:45.882074+00	\N	f	\N
\.


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."chapters" ("id", "story_id", "position", "title", "locked", "ydoc", "created_at", "word_count", "author_chars", "edited_at") FROM stdin;
68feeae7-a40b-4a49-8e35-fcf9cc3179dc	e6b0f062-29a8-4847-b0ed-0646bdd01516	1	Chapter 1	f	\N	2026-10-10 20:58:22.324659+00	0	{}	\N
d6c0972e-b71b-4f48-bc30-dec07ea187da	fc9701a1-dbfd-40b3-a4c4-2a509052b072	1	Chapter 1	f	\\x0305cf8e90c90900c4d690b8bd011ed690b8bd01041a205468697320697320746865207365636f6e642073656e74656ec1cf8e90c90919d690b8bd010402c4cf8e90c9091bd690b8bd0104026365c1cf8e90c9091dd690b8bd010401c4cf8e90c9091ed690b8bd0104012e04f98ab6a10800c4d690b8bd0115d690b8bd01160146c6d690b8bd0115f98ab6a1080006617574686f72447b22757365724964223a2265626132623731622d313432392d343438612d393339642d363133626166663962323363222c226174223a313739313636383130363536367dc6f98ab6a10800d690b8bd011606617574686f72447b22757365724964223a2263616136343062652d386664612d346332322d393231322d623164636261636463376532222c226174223a313739313636383130303035387dc4f98ab6a10800f98ab6a1080205495253542008d690b8bd010007010764656661756c7403097061726167726170680700d690b8bd0100060600d690b8bd010106617574686f72447b22757365724964223a2263616136343062652d386664612d346332322d393231322d623164636261636463376532222c226174223a313739313636383130303035387d84d690b8bd0102015486d690b8bd010306617574686f72046e756c6cc4d690b8bd0103d690b8bd01040b6869732069732074686520c1d690b8bd010fd690b8bd010406c4d690b8bd0115d690b8bd01040973656e74656e63652e02cf8e90c909021a021e01d690b8bd01011006	2026-10-10 21:33:45.882074+00	10	{"caa640be-8fda-4c22-9212-b1dcbacdc7e2": 50, "eba2b71b-1429-448a-939d-613baff9b23c": 6}	2026-10-10 21:37:30.043139+00
7e30ed93-67f0-4a79-94dd-83c67faf5995	fc9701a1-dbfd-40b3-a4c4-2a509052b072	2	Chapter 2	f	\N	2026-10-10 22:05:35.79706+00	0	{}	\N
\.


--
-- Data for Name: chapter_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."chapter_snapshots" ("id", "chapter_id", "taken_at", "name", "state", "content_hash") FROM stdin;
48894058-4880-4f6c-9204-15f3f0c3f13b	d6c0972e-b71b-4f48-bc30-dec07ea187da	2026-10-10 22:01:48.24271+00	\N	\\x0305cf8e90c90900c4d690b8bd011ed690b8bd01041a205468697320697320746865207365636f6e642073656e74656ec1cf8e90c90919d690b8bd010402c4cf8e90c9091bd690b8bd0104026365c1cf8e90c9091dd690b8bd010401c4cf8e90c9091ed690b8bd0104012e04f98ab6a10800c4d690b8bd0115d690b8bd01160146c6d690b8bd0115f98ab6a1080006617574686f72447b22757365724964223a2265626132623731622d313432392d343438612d393339642d363133626166663962323363222c226174223a313739313636383130363536367dc6f98ab6a10800d690b8bd011606617574686f72447b22757365724964223a2263616136343062652d386664612d346332322d393231322d623164636261636463376532222c226174223a313739313636383130303035387dc4f98ab6a10800f98ab6a1080205495253542008d690b8bd010007010764656661756c7403097061726167726170680700d690b8bd0100060600d690b8bd010106617574686f72447b22757365724964223a2263616136343062652d386664612d346332322d393231322d623164636261636463376532222c226174223a313739313636383130303035387d84d690b8bd0102015486d690b8bd010306617574686f72046e756c6cc4d690b8bd0103d690b8bd01040b6869732069732074686520c1d690b8bd010fd690b8bd010406c4d690b8bd0115d690b8bd01040973656e74656e63652e02cf8e90c909021a021e01d690b8bd01011006	fcecccbfe08119a6312505950fb84019710eb9377f772c0edf95885bac4f265e
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."profiles" ("id", "username", "author_color", "created_at", "theme", "last_seen", "show_online") FROM stdin;
caa640be-8fda-4c22-9212-b1dcbacdc7e2	nickjg	#d6409f	2026-10-10 20:58:11.599606+00	system	\N	t
eba2b71b-1429-448a-939d-613baff9b23c	nickil	#6e56cf	2026-10-10 21:34:15.908439+00	system	\N	t
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."chat_messages" ("id", "story_id", "user_id", "body", "created_at") FROM stdin;
\.


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."entries" ("id", "story_id", "type", "name", "description", "ydoc", "created_by", "created_at", "aliases", "link_entry_mentions") FROM stdin;
\.


--
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."friendships" ("requester_id", "addressee_id", "status", "created_at") FROM stdin;
caa640be-8fda-4c22-9212-b1dcbacdc7e2	eba2b71b-1429-448a-939d-613baff9b23c	accepted	2026-10-10 21:34:24.487464+00
\.


--
-- Data for Name: invites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."invites" ("id", "story_id", "invited_by", "invitee_id", "token", "created_at", "used_at", "used_by") FROM stdin;
caa17f88-c8e5-4f06-83a6-c9500306af24	fc9701a1-dbfd-40b3-a4c4-2a509052b072	caa640be-8fda-4c22-9212-b1dcbacdc7e2	eba2b71b-1429-448a-939d-613baff9b23c	\N	2026-10-10 21:34:47.271972+00	2026-10-10 21:34:50.787261+00	eba2b71b-1429-448a-939d-613baff9b23c
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."notes" ("id", "story_id", "chapter_id", "author_id", "quote", "body", "edited_at", "resolved_at", "resolved_by", "created_at") FROM stdin;
\.


--
-- Data for Name: note_replies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."note_replies" ("id", "note_id", "story_id", "chapter_id", "author_id", "body", "edited_at", "created_at") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."notifications" ("id", "recipient_id", "actor_id", "kind", "story_id", "story_title", "invite_id", "detail", "created_at", "read_at", "note_id") FROM stdin;
8f35521f-abbd-4e3c-a056-353553e874e2	caa640be-8fda-4c22-9212-b1dcbacdc7e2	eba2b71b-1429-448a-939d-613baff9b23c	writer_joined	fc9701a1-dbfd-40b3-a4c4-2a509052b072	Test	\N	{}	2026-10-10 21:34:50.787261+00	2026-10-10 21:37:46.507395+00	\N
1597fe35-3ce8-48e6-aaaa-8861ab0834ce	eba2b71b-1429-448a-939d-613baff9b23c	caa640be-8fda-4c22-9212-b1dcbacdc7e2	chapter_added	fc9701a1-dbfd-40b3-a4c4-2a509052b072	Test	\N	{"chapter_id": "7e30ed93-67f0-4a79-94dd-83c67faf5995", "chapter_title": "Chapter 2"}	2026-10-10 22:05:35.79706+00	\N	\N
\.


--
-- Data for Name: story_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."story_activity" ("story_id", "writers", "viewers", "updated_at") FROM stdin;
\.


--
-- Data for Name: story_changes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."story_changes" ("story_id", "changed_at") FROM stdin;
e6b0f062-29a8-4847-b0ed-0646bdd01516	2026-10-10 20:58:22.324659+00
fc9701a1-dbfd-40b3-a4c4-2a509052b072	2026-10-10 22:05:35.79706+00
\.


--
-- Data for Name: story_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."story_members" ("story_id", "user_id", "role", "joined_at", "author_color", "notify") FROM stdin;
e6b0f062-29a8-4847-b0ed-0646bdd01516	caa640be-8fda-4c22-9212-b1dcbacdc7e2	host	2026-10-10 20:58:22.324659+00	\N	all
fc9701a1-dbfd-40b3-a4c4-2a509052b072	caa640be-8fda-4c22-9212-b1dcbacdc7e2	host	2026-10-10 21:33:45.882074+00	\N	all
fc9701a1-dbfd-40b3-a4c4-2a509052b072	eba2b71b-1429-448a-939d-613baff9b23c	writer	2026-10-10 21:34:50.787261+00	\N	all
\.


--
-- Data for Name: story_presence; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."story_presence" ("id", "user_id", "story_id", "kind", "document_id", "connected_at") FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 4, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict GSE365RMuy3ruPvLRca2hJmtplVUHD1a7uEmaxaPyMuJB9ZyTjtV0DCbv6UjRYa

RESET ALL;
