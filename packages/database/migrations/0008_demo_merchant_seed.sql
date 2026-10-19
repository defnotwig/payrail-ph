-- Seed dedicated demo merchant API key for the public sandbox checkout demo
INSERT INTO payrail_private.merchant_api_keys (
  merchant_id,
  key_prefix,
  key_hash,
  name,
  scopes,
  environment
) VALUES (
  'merchant_default',
  'sk_test_',
  '8f1bddd25618db2c44b6a312dbb6196c704cec000396ee05c918006609a43d4a',
  'PayRail Demo Sandbox Key',
  '{"payments:read","payments:write"}',
  'test'
) ON CONFLICT (key_hash) DO NOTHING;
