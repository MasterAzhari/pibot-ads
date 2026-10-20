import type { Account, Media } from "@prisma/client";

export type PublishInput = { caption: string; media: Media | null };
export type PublishResult = { externalId: string; permalink?: string };

export interface Publisher {
  publish(account: Account, input: PublishInput): Promise<PublishResult>;
  /** undefined = platform API tak benarkan edit lepas post */
  edit?(account: Account, externalId: string, caption: string): Promise<void>;
  remove?(account: Account, externalId: string): Promise<void>;
}
