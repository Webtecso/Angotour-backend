const fs = require("fs")
const L = (...lines) => lines.join("\n")
const filePath = "src/app.module.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

if (content.includes("AdminAuthModule")) { console.log("AdminAuthModule ja esta no app.module.ts. Nada a fazer."); process.exit(0) }

const patches = [
  ["import",
    L("import { DriverAuthModule } from './modules/driver-auth/driver-auth.module';"),
    L("import { DriverAuthModule } from './modules/driver-auth/driver-auth.module';", "import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';")],
  ["lista de modulos",
    L("    DriverAuthModule,"),
    L("    DriverAuthModule,", "    AdminAuthModule,")],
]
for (const [label, anchor, replacement] of patches) {
  const count = content.split(anchor).length - 1
  console.log(label + " -> ancora " + count + "x")
  if (count !== 1) { console.error("ABORTADO em " + label + ". Nada foi escrito."); process.exit(1) }
  content = content.split(anchor).join(replacement)
}
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: " + filePath)
