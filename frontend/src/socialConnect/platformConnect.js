import api from "../api";
import ConfirmModal from "../components/modals/confirmModal";
import ConnectSocialButton from "./connectSocialButton";
import DisconnectSocialButton from "./disconnectSocialButton";
import { useState } from "react";

const PlatformConnect = () => {
    const [disconnectName, setDisconnectName] = useState('');
    const [disconnectPlatform, setDisconnectPlatform] = useState(null);
    const connected = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
	const hasReddit = connected.some(a => a.platform === "reddit");
	const hasBluesky = connected.some(a => a.platform === "bluesky");
	const hasMastodon = connected.some(a => a.platform === "mastodon");
	const anyNotConnected = !hasReddit || !hasBluesky || !hasMastodon;
    const [modalOpen, setModalOpen] = useState(false);

    const requestDisconnect = (platform, name) => {
		setDisconnectPlatform(platform);
		setDisconnectName(name);
		setModalOpen(true);
	};

    return (
        <>
            <div className="border-top-light">
                {anyNotConnected && (
                    <>
                        <p className="small-text">Connect your accounts from:</p>
                        {!hasReddit && <ConnectSocialButton socialIcon="/media/site_images/social_sites/reddit-logo.png" socialName="Reddit" socialRoute="auth/reddit" />}
                        {!hasBluesky && <ConnectSocialButton socialIcon="/media/site_images/social_sites/bluesky-logo.png" socialName="Bluesky" socialRoute="/connect/bluesky" />}
                        {!hasMastodon && <ConnectSocialButton socialIcon="/media/site_images/social_sites/mastodon-logo.png" socialName="Mastodon" socialRoute="/connect/mastodon" />}
                    </>
                )}
                {connected.length > 0 && (
                    <div className="mt-4">
                        <p className="small-text">Connected accounts:</p>
                        <p className="tiny-text faded-text">Click to disconnect</p>
                        {hasReddit && (
                            <DisconnectSocialButton socialIcon="/media/site_images/social_sites/reddit-logo.png" socialName="Reddit" platform="reddit" onRequestDisconnect={requestDisconnect} />
                        )}
                        {hasBluesky && (
                            <DisconnectSocialButton socialIcon="/media/site_images/social_sites/bluesky-logo.png" socialName="Bluesky" platform="bluesky" onRequestDisconnect={requestDisconnect} />
                        )}
                        {hasMastodon && (
                            <DisconnectSocialButton socialIcon="/media/site_images/social_sites/mastodon-logo.png" socialName="Mastodon" platform="mastodon" onRequestDisconnect={requestDisconnect} />
                        )}
                    </div>
                )}
            </div>
            <ConfirmModal
                isOpen={modalOpen}
                title="Disconnect account"
                message={`Are you sure you want to disconnect your ${disconnectName} account?`}
                onCancel={() => setModalOpen(false)}
                onConfirm={async () => {
                    try {
                        await api.post('/disconnect_external_account', { platform: disconnectPlatform });
                        const existing = JSON.parse(localStorage.getItem("connectedAccounts") || "[]");
                        const updated = existing.filter(a => a.platform !== disconnectPlatform);
                        localStorage.setItem("connectedAccounts", JSON.stringify(updated));
                        window.dispatchEvent(new CustomEvent('connectedAccountsUpdated'));
                        setModalOpen(false);
                    } catch (error) { }
                }}
            />
        </>
    );
};

export default PlatformConnect;