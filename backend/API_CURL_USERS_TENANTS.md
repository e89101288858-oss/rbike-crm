## Admin Users API (OWNER only)

Create user:

```bash
curl -X POST http://localhost:3000/admin/users ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <OWNER_JWT>" ^
  -d "{\"email\":\"manager@example.com\",\"password\":\"secret123\",\"role\":\"MANAGER\"}"
```

List users:

```bash
curl http://localhost:3000/admin/users ^
  -H "Authorization: Bearer <OWNER_JWT>"
```

Get user by id:

```bash
curl http://localhost:3000/admin/users/<USER_ID> ^
  -H "Authorization: Bearer <OWNER_JWT>"
```

Update user (change role, isActive, reset password):

```bash
curl -X PATCH http://localhost:3000/admin/users/<USER_ID> ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <OWNER_JWT>" ^
  -d "{\"role\":\"MECHANIC\",\"isActive\":true,\"password\":\"newpass123\"}"
```

## User-Tenant assignment API (OWNER or FRANCHISEE)

Assign user to tenant:

```bash
curl -X POST http://localhost:3000/tenants/<TENANT_ID>/users ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <OWNER_OR_FRANCHISEE_JWT>" ^
  -d "{\"userId\":\"<USER_ID>\"}"
```

Remove user from tenant:

```bash
curl -X DELETE http://localhost:3000/tenants/<TENANT_ID>/users/<USER_ID> ^
  -H "Authorization: Bearer <OWNER_OR_FRANCHISEE_JWT>"
```

List users for tenant:

```bash
curl http://localhost:3000/tenants/<TENANT_ID>/users ^
  -H "Authorization: Bearer <OWNER_OR_FRANCHISEE_JWT>"
```

