import axios from 'axios'
import { WebContainer }	from '@webcontainer/api'
import PropTypes from 'prop-types'
import { useEffect, useRef } from 'react'

const AppWebContainer = ({ buildId }) => {
	const iframeRef = useRef(null)
	const port = process.env.REACT_APP_WC_PORT || '3000'

	useEffect(() => {
		(async () => {
			const { data: buffer } = await axios.get(`/app_builds/${buildId}.zip`, { responseType: 'arraybuffer' })
			const vc = await WebContainer.boot()
			await vc.mount(buffer)
			const modulesExist = await vc.fs.stat('/node_modules').catch(() => null)
			if (!modulesExist) await vc.spawn('npm', ['ci', '--omit=dev'])
			const portHandle = vc.ports.from(Number(port))
			await portHandle.expose()
			await vc.spawn('npm', ['run', 'start'], { env: { PORT: port } })
			iframeRef.current.src   = portHandle.url
		})()
	}, [buildId, port])

	return (
		<iframe
			ref={iframeRef}
			sandbox="allow-scripts allow-same-origin"
			style={{ border: 'none', minHeight: '50vh', width: '100%' }}
			title={`app-block-${buildId}`}
		/>
	)
}

AppWebContainer.propTypes = { buildId: PropTypes.string.isRequired }

export default AppWebContainer