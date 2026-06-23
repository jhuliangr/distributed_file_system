# DFS Client (Alberto)

CLI that hides the distribution. Splits a file into **1024-byte chunks**,
replicates each chunk onto **≥2 storage servers**, and registers the layout in
the naming server. Read reassembles from whichever replica is alive.

No dependencies beyond Node built-ins (`fetch`, `node:crypto`, `node:fs`).
Single file: [`dfs.ts`](dfs.ts).

## Usage

```bash
export NAMING_URL=http://localhost:8000          # default: http://naming-server:8000

node client/dfs.ts create ./report.txt           # split, replicate, register
node client/dfs.ts read   report.txt out.txt     # reassemble to out.txt (omit arg -> stdout)
node client/dfs.ts size   report.txt             # bytes, from metadata only
node client/dfs.ts delete report.txt             # remove metadata + chunk bytes
```

## Operations

| Cmd      | Naming server                          | Storage servers                       |
| -------- | -------------------------------------- | ------------------------------------- |
| `create` | `GET /storage`, `POST /files`          | `PUT /chunks/<id>` ×2 per chunk        |
| `read`   | `GET /files/<name>`                    | `GET /chunks/<id>` (next replica on fail) |
| `delete` | `DELETE /files/<name>`                 | `DELETE /chunks/<id>` (best effort)   |
| `size`   | `GET /files/<name>/size`               | —                                     |

On a failed chunk fetch/upload the client reports the server via
`POST /storage/<address>/status {alive:false}` and falls back to another
replica — so a single storage server down does not break `read`.
