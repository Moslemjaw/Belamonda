import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const userId = "6a149c3a4b6ae706d27319e7"; // The new customer
  const token = jwt.sign({ userId, role: "customer" }, process.env.JWT_SECRET || "default_secret", { expiresIn: "1h" });

  try {
    const res = await fetch("http://localhost:3000/api/commerce/me/offers", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to fetch:", err);
  }
}
main();
