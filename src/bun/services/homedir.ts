import * as os from 'os';
export function homedir(): string {
  return process.env.MARKBUN_E2E_HOME || os.homedir();
}
