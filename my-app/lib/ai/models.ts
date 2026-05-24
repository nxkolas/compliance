import { customProvider } from "ai";
import {
  getChatModelName,
  getChatProvider,
  getEmbeddingModelName,
  getEmbeddingProvider,
  getSmallChatModelName,
} from "./providers";

export function getComplianceChatModel() {
  return getChatProvider()(getChatModelName());
}

export function getComplianceTitleModel() {
  return getChatProvider()(getSmallChatModelName());
}

export function getComplianceEmbeddingModel() {
  return getEmbeddingProvider().embeddingModel(getEmbeddingModelName());
}

export function getComplianceProvider() {
  const chatProvider = getChatProvider();

  return customProvider({
    languageModels: {
      "chat-model": chatProvider(getChatModelName()),
      "title-model": chatProvider(getSmallChatModelName()),
      "artifact-model": chatProvider(getChatModelName()),
    },
  });
}
