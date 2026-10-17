import { randomBytes, scryptSync } from "node:crypto";
// Read stdin only: never put a password in process arguments, env or shell history.
if (process.stdin.isTTY || process.argv.length > 2) {
  console.error(
    "Pipe a password from a hidden prompt through stdin; command-line password arguments are refused.",
  );
  process.exitCode = 1;
} else {
  let input = "";
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (Buffer.byteLength(input) > 1024) throw Error("Password too long.");
  }
  const password = input.replace(/\r?\n$/, "");
  if (password.length < 12) throw Error("Use at least 12 characters.");
  const salt = randomBytes(16).toString("hex");
  console.log(salt + ":" + scryptSync(password, salt, 64).toString("hex"));
}
