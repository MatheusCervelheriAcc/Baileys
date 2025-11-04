import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState, OutgoingNodeTransformer, BinaryNode } from '../src'
import { Boom } from '@hapi/boom'
import P from 'pino'

const logger = P({ level: 'info' })

const startSock = async() => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const transformer: OutgoingNodeTransformer = (node: BinaryNode) => {
		// ex.: log and return without modification
		console.log('Transforming outgoing node:', node)
		return node
	}

	const sock = makeWASocket({
		version,
		logger,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		transformOutgoingNode: transformer
	})

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update
		if(connection === 'close') {
			const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
			console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)
			// reconnect if not logged out
			if(shouldReconnect) {
				startSock()
			}
		} else if(connection === 'open') {
			console.log('opened connection')
		}
	})

	sock.ev.on('creds.update', saveCreds)

	return sock
}

startSock()
