import ExcelJS from "exceljs";

async function run() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("../clinic_performance_test.xlsx");
  console.log("Sheets in workbook:");
  wb.eachSheet((ws, id) => {
    console.log(`- Sheet ID: ${id}, Name: ${ws.name}, Rows: ${ws.rowCount}`);
  });
}

run().catch(console.error);
