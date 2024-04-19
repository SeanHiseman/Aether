import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ContentWidget from '../components/contentWidget';
import GroupWidget from '../components/search/groupWidget';
import ProfileWidget from '../components/search/profileWidget';

const SearchResults = () => {
    const [groupResults, setGroupResults] = useState([]);
    const [postResults, setPostResults] = useState([]);
    const [profileResults, setProfileResults] = useState([]);
    const { tab = 'posts' } = useParams(); 
    //Gets search term
    const [searchParams] = useSearchParams();
    const keyword = (searchParams.get('keyword') || '').trim();

    //Gets results depending on which type is being viewed
    useEffect(() => {
        const fetchResults = async () => {
            try {
                const response = await axios.get(`/api/search/${tab}?keyword=${keyword}`);
                switch (tab) {
                    case 'groups':
                        setGroupResults(response.data);
                        break;
                    case 'posts':
                        setPostResults(response.data);
                        break;
                    case 'profiles':
                        const profileData = response.data.map((user) => user.profile);
                        setProfileResults(profileData);
                        break;
                    default:
                        break;
                }   
            } catch (error) {
                console.error(error);
            }
        };

        if (keyword) {
            fetchResults();
        }
    }, [keyword, tab]);

    //Determines widget based on result type
    const renderResults = () => {
        switch (tab) {
            case 'posts':
                if (postResults.length > 0) {
                    return postResults.map((post) => (
                        <ContentWidget key={post.post_id} post={post} isGroup={false} />
                    ));
                } else {
                    return <div>No results</div>;  
                }
            case 'groups':
                if (groupResults.length > 0) {
                    return groupResults.map((group) => (
                        <GroupWidget key={group.group_id} group={group} />
                    ));
                } else {
                    return <div>No results</div>;  
                }
            case 'profiles':
                if (profileResults.length > 0) {
                    return profileResults.map((profile) => (
                        <ProfileWidget key={profile.profile_id} profile={profile} />
                    ));
                } else {
                    return <div>No results</div>;
                }
            default:
                return null;
        }
    };

    return (
        <div className="search-container">
            <div className="content-feed">
                <div id="channel-content">
                    <ul className="content-list">
                        {renderResults()}
                    </ul>
                </div>
            </div>
            <div id="right-aside">
                <h1>Results</h1>
                <nav id="channel-list">
                    <ul>
                        <Link to={`/search/posts?keyword=${keyword}`}>
                            <li className="channel-link">Posts</li>
                        </Link>
                        <Link to={`/search/groups?keyword=${keyword}`}>
                            <li className="channel-link">Groups</li>
                        </Link>
                        <Link to={`/search/profiles?keyword=${keyword}`}>
                            <li className="channel-link">Profiles</li>
                        </Link>
                    </ul>
                </nav>
            </div>
        </div>
    )
}

export default SearchResults;
