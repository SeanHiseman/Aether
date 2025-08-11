import PropTypes from 'prop-types'
import { useRef } from 'react'

const AppBlock = ({ appPath }) => {
    const iframeRef = useRef(null)
    const MIN_HEIGHT = 300
    const onLoad = e => {
        try {
            const doc = e.target.contentWindow.document
            const h = Math.max(doc.body.scrollHeight, MIN_HEIGHT)
            e.target.style.height = `${h}px`
        } catch {}
    }
    return (
        <iframe
            key={appPath}
            ref={iframeRef}
            sandbox="allow-downloads allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts"
            src={`${appPath}/index.html`}
            style={{ border: 'none', width: '100%', height: '100%', minHeight: '300px' }}
            title={`app-block-${appPath}`}
            onLoad={onLoad}
        />
    )
}

AppBlock.propTypes = { appPath: PropTypes.string.isRequired }
export default AppBlock