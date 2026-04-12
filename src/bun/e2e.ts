import { main } from './app';
import { guardTest, createTestRequests } from './test-rpcs';
import { appState } from './app';

const testRequests: Record<string, any> = {};

if (process.env.MARKBUN_TEST === '1') {
  Object.assign(testRequests, createTestRequests(() => appState));
}

main(testRequests).catch(console.error);
