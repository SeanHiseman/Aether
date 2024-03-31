import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContentWidget from '../components/contentWidget';
import GroupWidget from '../components/search/groupWidget';
import ProfileWidget from '../components/search/profileWidget';

const SearchResults = () => {
    const [groupResults, setGroupResults] = useState([]);
    const [postResults, setPostResults] = useState([]);
    const [profileResults, setProfileResults] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedTab, setSelectedTab] = useState('posts');

    //Gets search term
    const [searchParams] = useSearchParams();
    const keyword = searchParams.get('keyword') || '';

    //Gets results depending on which type is being viewed
    useEffect(() => {
        const fetchResults = async (tab) => {
            try {
                const keyword = searchKeyword.trim();
                if (keyword) {
                    const response = await axios.get(`/search/${tab}?keyword=${keyword}`);
                    switch (tab) {
                        case 'groups':
                            setGroupResults(response.data);
                            break;
                        case 'posts':
                            setPostResults(response.data);
                            break;
                        case 'profiles':
                            setProfileResults(response.data);
                            break;
                        default:
                            break;
                    }
                }   
            } catch (error) {
                console.error(error);
            }
        };

        if (keyword) {
            fetchResults();
        }
    }, [keyword, selectedTab]);

    //Switches between result types
    const handleTabChange = (tab) => {
        setSelectedTab(tab);
    };

    //Determines widget based on result type
    const renderResults = () => {
        switch (selectedTab) {
            case 'posts':
                return postResults.map((post) => (
                    <ContentWidget key={post.post_id} post={post} isGroup={false} />
                ));
            case 'groups':
                return groupResults.map((group) => (
                    <GroupWidget key={group.group_id} group={group} />
                ));
            case 'profiles':
                return profileResults.map((profile) => (
                    <ProfileWidget key={profile.profile_id} profile={profile} />
                ));
            default:
                return null;
        }
    };

    return (
        <div className="search-container">
            <div className="content-feed">
                {renderResults()}
            </div>
            <div id="right-aside">
                <h1>Search results</h1>
                <nav>
                    <li onClick={() => handleTabChange('posts')}>Posts</li>
                    <li onClick={() => handleTabChange('groups')}>Groups</li>
                    <li onClick={() => handleTabChange('profiles')}>Profiles</li>
                </nav>
            </div>
        </div>
    )
}

export default SearchResults;
