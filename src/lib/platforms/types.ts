import type { Account, Media } from "@prisma/client";

export type PublishInput = { caption: string; media: Media | null };
export type PublishResult = { externalId: string; permalink?: string };

export interface Publisher {
  publish(account: Account, input: PublishInput): Promise<PublishResult>;
  /** undefined = the platform API does not allow edits after posting */
  edit?(account: Account, externalId: string, caption: string): Promise<void>;
  remove?(account: Account, externalId: string): Promise<void>;
}
