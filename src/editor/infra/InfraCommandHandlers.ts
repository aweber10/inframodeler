import type CommandStack from 'diagram-js/lib/command/CommandStack';

import UpdateTextHandler from './commands/UpdateTextHandler';

export default class InfraCommandHandlers {
  static $inject = ['commandStack'];

  constructor(commandStack: CommandStack) {
    commandStack.registerHandler('infra.updateText', UpdateTextHandler);
  }
}
