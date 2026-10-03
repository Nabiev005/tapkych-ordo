import { EventEmitter } from 'node:events';

/**
 * REST маршруттары менен Socket.IO катмарын байланыштыруучу ички окуялар.
 *  - 'game:changed' (gameId)         — оюнчулар/жөндөөлөр өзгөрдү, абалды кайра жөнөтүү керек
 *  - 'player:session' (playerId)     — оюнчу жаңы түзмөктөн кирди, эскисин ажыратуу керек
 */
export const bus = new EventEmitter();
