import { handle } from '@hono/node-server/vercel'
import app from '../backend/src/app.js'

export default handle(app)
