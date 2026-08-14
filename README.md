# IBU POS Owner

Owner phone app: live sales, previous sales, deleted items, manual cash drawer.

Hosted on Vercel. POS cashier PC posts compact snapshots (not a full DB dump).

## Default login
PIN: `1234`

Change these Vercel environment variables before going live:
- `OWNER_PIN`
- `POS_DEVICE_KEY` (must match `OwnerCloud.json` on the POS PC)
- `OUTLET_ID` (default `ibu-main`)
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel KV — keeps data after sleep)

POS settings file: `%ProgramData%\DeskPOS\AdminSetting\OwnerCloud.json`
