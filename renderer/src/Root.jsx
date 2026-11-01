import React from 'react';
import {Composition} from 'remotion';
import {LunaEpisode, getEpisodeConfig} from './LunaEpisode.jsx';

export const LunaRoot = () => (
  <Composition
    id="LunaEpisode"
    component={LunaEpisode}
    durationInFrames={getEpisodeConfig({}).durationInFrames}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({props}) => getEpisodeConfig(props)}
    defaultProps={{episode: {}, shots: [], targetFormat: '9:16'}}
  />
);
