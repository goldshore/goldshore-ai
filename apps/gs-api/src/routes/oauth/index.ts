import { Hono } from 'hono';
import github from './github';

export const oauth = new Hono();

oauth.route('/github', github);

export default oauth;
