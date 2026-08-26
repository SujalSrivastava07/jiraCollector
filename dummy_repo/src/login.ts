export function login(username: string) {
  if (!username) {
    throw new Error("Username required");
  }
  // TODO: Fix Safari login issue where localStorage fails
  console.log("Logging in " + username);
  return true;
}
