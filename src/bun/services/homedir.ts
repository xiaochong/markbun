import { homedir as osHomedir } from 'os';
export function homedir(): string {
  return process.env.MARKBUN_E2E_HOME || osHomedir();
}
