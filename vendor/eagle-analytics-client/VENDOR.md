# Vendored copy

`README.md`, `package.json` and `dist/` in this directory are copied verbatim from
an upstream release of the EPIC analytics browser client. Do not edit them here;
change them upstream and re-vendor.

Parts of the upstream `README.md` do not apply here. Its Install section covers
pulling the package from GitHub Packages with an auth token; eagle-public instead
resolves it from this directory (`"@digitalspace/eagle-analytics-client":
"file:./vendor/eagle-analytics-client"` in the root `package.json`), so no registry
and no token are involved. Its Vendoring section is an example pinned to an older
version. The tag and hash below are the ones this checkout actually carries.

| Field | Value |
|---|---|
| Upstream repo | `digitalspace/eagle-analytics` (`client/`) |
| Release tag | `client-v0.1.1` |
| Tarball | `eagle-analytics-client-0.1.1.tgz` |
| Tarball SHA256 | `d785a4115d2feeb420d1642e34fd6932145b37433636e801131c94595d6c6ad6` |

## Refresh

```sh
gh release download client-v0.1.1 -R digitalspace/eagle-analytics -p '*'
sha256sum -c SHA256SUMS --ignore-missing
tar -xzf eagle-analytics-client-0.1.1.tgz
cp package/README.md package/package.json vendor/eagle-analytics-client/
cp package/dist/* vendor/eagle-analytics-client/dist/
```

The release also publishes `SHA256SUMS`, covering the tarball and each file under
`dist/`. Verify both before copying, then update the tag and hash above.
