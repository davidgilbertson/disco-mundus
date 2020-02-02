/* eslint-disable */

import {Store} from 'react-recollect';

declare module 'react-recollect' {
  interface Store {
    [propName: string]: any;
  }
}
