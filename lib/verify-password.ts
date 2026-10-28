type VerificationAuth = {
  signInWithPassword(credentials: {email: string; password: string}): PromiseLike<{error: unknown}>;
  signOut(options: {scope: 'local'}): PromiseLike<{error: unknown}>;
};
/** Clean up only the temporary verification session, never the browser's session. */
export async function verifyPassword(auth: VerificationAuth, email: string, password: string) {
  if (!password) throw Error('Your password is required');
  const {error} = await auth.signInWithPassword({email, password});
  if (error) throw Error('Incorrect password');
  const {error: cleanupError} = await auth.signOut({scope: 'local'});
  if (cleanupError) throw Error('Could not close password verification session; please retry');
}
