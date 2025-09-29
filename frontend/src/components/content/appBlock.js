import PropTypes from 'prop-types'
import { useRef } from 'react'

const AppBlock = ({ appPath }) => {
    const iframeRef = useRef(null)

    return (
        <iframe
            key={appPath}
            ref={iframeRef}
            sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
            src={`${appPath}/index.html`}
            style={{ border: 'none', width: '100%', height: '100%', minHeight: '300px' }}
            title={`app-block-${appPath}`}
        />
    )
}

AppBlock.propTypes = { appPath: PropTypes.string.isRequired }
export default AppBlock