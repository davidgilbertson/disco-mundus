import { Store } from 'react-recollect';
import * as mapboxgl from 'mapbox-gl';
import { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { DisplayPhase } from './enums';

declare global {
  type AnswerHistoryItem = {
    id: number;
    lastScore: number;
    nextAskDate: number;
    lastAskDate: number;
  };

  type AnswerHistory = AnswerHistoryItem[];

  type LngLatArray = [number, number];

  type PlaceTapEvent = {
    coords: LngLatArray;
    feature: QuestionFeature;
  };

  type PlaceTapEventHandler = (e?: PlaceTapEvent) => void;

  // We add properties and narrow down the allowed geometries of Feature
  type QuestionFeature = Omit<Feature, 'geometry'> & {
    id: number;
    properties: {
      answeredThisSession: boolean;
      center: LngLatArray;
      lastAskDate: number;
      lastScore: number;
      name: string;
      nextAskDate: number;
    };
    geometry: Polygon | MultiPolygon;
  };

  // Replace the features type of FeatureCollection
  type QuestionFeatureCollection = Omit<FeatureCollection, 'features'> & {
    features: QuestionFeature[];
  };

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
    answer: {
      text: string;
      nextAskDate: string;
    };
    currentQuestion: QuestionFeature;
    displayPhase?: DisplayPhase;
    isSignificantSession: boolean;
    questionFeatures: Map<number, QuestionFeature>;
    sessionQueue: Set<number>;
    sessionStats: SessionStats;
  }
}
