import mongoose from "mongoose";

export async function connectDb(uri: string) {
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);
  console.log("[db] connected", uri.replace(/\/\/.*@/, "//***@"));
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
