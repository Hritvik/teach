import {createProductionHandler} from './index.ts';
export {SecurityLedger} from './security/index.ts';
/** Fixed capture surface: environment variables cannot enable assessment or scheduled work. */
export default createProductionHandler('capture');
