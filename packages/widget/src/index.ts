export { ShoppingAssistant, type ShoppingAssistantProps } from './ShoppingAssistant';
export { mount, optionsFromDataset, type MountedWidget } from './mount';
export { Widget, MAX_MESSAGE_CHARS, type WidgetProps } from './components/Widget';
export {
  ChatClient,
  type ChatClientOptions,
  type ChatController,
  type ChatError,
  type ChatMessage,
  type ChatState,
  type ChatStorage,
  type MessagePart,
} from './chat/client';
export {
  createTranslator,
  directionOf,
  LANGUAGES,
  type StringKey,
  type Strings,
  type Translate,
} from './i18n/index';
export type * from './types';
