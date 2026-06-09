import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.resolve(__dirname, "../../../client_credentials.json");
const csvPath = "C:\\\\Users\\\\musal\\\\.gemini\\\\antigravity\\\\brain\\\\0899413a-4726-448e-8fc5-e19f52b0b1cb\\\\client_credentials.csv";

const data = JSON.parse(fs.readFileSync(credsPath, "utf-8"));

let csvContent = "Index,Name,Username,Password\n";
for (const row of data) {
  csvContent += `${row.idx},"${row.name}","${row.username}","${row.password}"\n`;
}

fs.writeFileSync(csvPath, csvContent, "utf-8");
console.log(`Successfully converted ${data.length} accounts to CSV at ${csvPath}`);
