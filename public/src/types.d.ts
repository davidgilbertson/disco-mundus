import { Store } from 'react-recollect';
import * as mapboxgl from 'mapbox-gl';
import { Feature, FeatureCollection, MultiPolygon, Polygon, } from 'geojson';
import { DisplayPhase } from './enums';

declare global {
  type AnswerHistoryItem = {
    id: number;
    lastScore: number;
    nextAskDate: number;
    lastAskDate: number;
  }

  type AnswerHistory = AnswerHistoryItem[];

  type LngLatArray = [number, number];

  type MapTapData = {
    clickCoords: LngLatArray;
    clickedFeature: QuestionFeature;
  };

  interface QuestionFeature extends Feature {
    id: number;
    properties: {
      answeredThisSession: boolean;
      center: [number, number];
      lastAskDate: number;
      lastScore: number;
      name: string;
      nextAskDate: number;
    };
    geometry: Polygon | MultiPolygon;
  }

  interface QuestionFeatureCollection extends FeatureCollection {
    features: QuestionFeature[];
  }

  type SessionStat = {
    name: string;
    count: number;
  };

  type SessionStats = Record<'WRONG' | 'CLOSE' | 'RIGHT', SessionStat>;

  interface Window {
    DM_MAP: mapboxgl.Map;
    DM_STORE: Store;
    DM_VERSION: number;
  }
}

declare module 'react-recollect' {
  interface Store {
    displayPhase: DisplayPhase;
    answer: {
      text: string;
      nextAskDate: string;
    };
    questionFeatures: Map<number | string, QuestionFeature>;
    currentQuestion: QuestionFeature;
    sessionQueue: Set<number | string>;
    isSignificantSession: boolean;
    sessionStats: SessionStats;
  }
}
