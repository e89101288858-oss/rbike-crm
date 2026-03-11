#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'src')

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const controllers = walk(srcDir).filter((p) => p.endsWith('.controller.ts'))

const issues = []
for (const file of controllers) {
  const text = fs.readFileSync(file, 'utf8')
  const hasFranchisee = /@Roles\([^)]*'FRANCHISEE'/.test(text)
  const hasSaas = /@Roles\([^)]*'SAAS_USER'/.test(text)
  const hasTenantModes = /@TenantModes\(/.test(text)

  if (hasFranchisee && hasSaas) {
    issues.push(`[MIXED_ROLES] ${path.relative(root, file)} has both FRANCHISEE and SAAS_USER`)
  }

  if (/@Controller\(/.test(text) && /@UseGuards\([^)]*TenantGuard/.test(text) && !hasTenantModes) {
    issues.push(`[NO_TENANT_MODES] ${path.relative(root, file)} uses TenantGuard but has no @TenantModes`)
  }
}

if (!issues.length) {
  console.log('domain-boundaries: OK')
  process.exit(0)
}

console.log('domain-boundaries: WARN')
for (const i of issues) console.log('-', i)

// Foundation stage: warning-only (non-blocking)
process.exit(0)
