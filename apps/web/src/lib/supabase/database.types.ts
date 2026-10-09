
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "chapter_snapshots": {
                  Row: {
                    "chapter_id": string,"content_hash": string,"id": string,"name": string | null,"state": string,"taken_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_id": string,"content_hash": string,"id"?: string,"name"?: string | null,"state": string,"taken_at"?: string
                  }
                  Update: {
                    "chapter_id"?: string,"content_hash"?: string,"id"?: string,"name"?: string | null,"state"?: string,"taken_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapter_snapshots_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    }
                  ]
                },"chapters": {
                  Row: {
                    "author_chars": NonNullable<Json>,"created_at": string,"edited_at": string | null,"id": string,"locked": boolean,"position": number,"story_id": string,"title": string,"word_count": number,"ydoc": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_chars"?: NonNullable<Json>,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"locked"?: boolean,"position": number,"story_id": string,"title": string,"word_count"?: number,"ydoc"?: string | null
                  }
                  Update: {
                    "author_chars"?: NonNullable<Json>,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"locked"?: boolean,"position"?: number,"story_id"?: string,"title"?: string,"word_count"?: number,"ydoc"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"story_id": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"entries": {
                  Row: {
                    "aliases": (string)[],"created_at": string,"created_by": string | null,"description": string,"id": string,"link_entry_mentions": boolean,"name": string,"story_id": string,"type": Database["public"]['Enums']["entry_type"],"ydoc": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"link_entry_mentions"?: boolean,"name": string,"story_id": string,"type": Database["public"]['Enums']["entry_type"],"ydoc"?: string | null
                  }
                  Update: {
                    "aliases"?: (string)[],"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"link_entry_mentions"?: boolean,"name"?: string,"story_id"?: string,"type"?: Database["public"]['Enums']["entry_type"],"ydoc"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "addressee_id": string,"created_at": string,"requester_id": string,"status": Database["public"]['Enums']["friendship_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"requester_id": string,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string,"invitee_id": string | null,"story_id": string,"token": string | null,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by": string,"invitee_id"?: string | null,"story_id": string,"token"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string,"invitee_id"?: string | null,"story_id"?: string,"token"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_invitee_id_fkey"
      columns: ["invitee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"note_replies": {
                  Row: {
                    "author_id": string | null,"body": string,"chapter_id": string,"created_at": string,"edited_at": string | null,"id": string,"note_id": string,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"chapter_id": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"note_id": string,"story_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"chapter_id"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"note_id"?: string,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_replies_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_replies_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_replies_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "note_replies_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "author_id": string | null,"body": string,"chapter_id": string,"created_at": string,"edited_at": string | null,"id": string,"quote": string,"resolved_at": string | null,"resolved_by": string | null,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"chapter_id": string,"created_at"?: string,"edited_at"?: string | null,"id": string,"quote": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"story_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"chapter_id"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"quote"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"story_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"detail": NonNullable<Json>,"id": string,"invite_id": string | null,"kind": Database["public"]['Enums']["notification_kind"],"note_id": string | null,"read_at": string | null,"recipient_id": string,"story_id": string | null,"story_title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"invite_id"?: string | null,"kind": Database["public"]['Enums']["notification_kind"],"note_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"story_id"?: string | null,"story_title": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: string,"invite_id"?: string | null,"kind"?: Database["public"]['Enums']["notification_kind"],"note_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"story_id"?: string | null,"story_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_invite_id_fkey"
      columns: ["invite_id"]
isOneToOne: false
      referencedRelation: "invites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "author_color": string,"created_at": string,"id": string,"last_seen": string | null,"show_online": boolean,"theme": Database["public"]['Enums']["theme"],"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_color": string,"created_at"?: string,"id": string,"last_seen"?: string | null,"show_online"?: boolean,"theme"?: Database["public"]['Enums']["theme"],"username": string
                  }
                  Update: {
                    "author_color"?: string,"created_at"?: string,"id"?: string,"last_seen"?: string | null,"show_online"?: boolean,"theme"?: Database["public"]['Enums']["theme"],"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stories": {
                  Row: {
                    "blurb": string | null,"created_at": string,"finished_at": string | null,"hidden_from_front": boolean,"id": string,"status": Database["public"]['Enums']["story_status"],"title": string,"visibility": Database["public"]['Enums']["story_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "blurb"?: string | null,"created_at"?: string,"finished_at"?: string | null,"hidden_from_front"?: boolean,"id"?: string,"status"?: Database["public"]['Enums']["story_status"],"title": string,"visibility"?: Database["public"]['Enums']["story_visibility"]
                  }
                  Update: {
                    "blurb"?: string | null,"created_at"?: string,"finished_at"?: string | null,"hidden_from_front"?: boolean,"id"?: string,"status"?: Database["public"]['Enums']["story_status"],"title"?: string,"visibility"?: Database["public"]['Enums']["story_visibility"]
                  }
                  Relationships: [
                    
                  ]
                },"story_activity": {
                  Row: {
                    "story_id": string,"updated_at": string,"viewers": number,"writers": number
                  }
                  ComputedFields: never
                  Insert: {
                    "story_id": string,"updated_at"?: string,"viewers"?: number,"writers"?: number
                  }
                  Update: {
                    "story_id"?: string,"updated_at"?: string,"viewers"?: number,"writers"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_activity_story_id_fkey"
      columns: ["story_id"]
isOneToOne: true
      referencedRelation: "stories"
      referencedColumns: ["id"]
    }
                  ]
                },"story_changes": {
                  Row: {
                    "changed_at": string,"story_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"story_id": string
                  }
                  Update: {
                    "changed_at"?: string,"story_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"story_members": {
                  Row: {
                    "author_color": string | null,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_color"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"story_id": string,"user_id": string
                  }
                  Update: {
                    "author_color"?: string | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_members_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"story_presence": {
                  Row: {
                    "connected_at": string,"document_id": string,"id": string,"kind": string,"story_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connected_at"?: string,"document_id": string,"id"?: string,"kind": string,"story_id": string,"user_id": string
                  }
                  Update: {
                    "connected_at"?: string,"document_id"?: string,"id"?: string,"kind"?: string,"story_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "story_presence_story_id_fkey"
      columns: ["story_id"]
isOneToOne: false
      referencedRelation: "stories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "story_presence_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_invite": string }; Returns: string
                           },
"accept_invite_link":
{ Args: { "p_token": string }; Returns: string
                           },
"add_chapter":
{ Args: { "p_story": string,"p_title": string }; Returns: string
                           },
"add_note":
{ Args: { "p_body": string,"p_chapter": string,"p_id": string,"p_quote": string }; Returns: undefined
                           },
"are_friends":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"assign_story_color":
{ Args: { "p_story": string,"p_user": string }; Returns: undefined
                           },
"author_palette":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"authorize_restore":
{ Args: { "p_snapshot": string }; Returns: string
                           },
"authorize_snapshot":
{ Args: { "p_chapter": string }; Returns: string
                           },
"befriend":
{ Args: { "a": string,"b": string }; Returns: undefined
                           },
"can_view_story":
{ Args: { "p_story": string }; Returns: boolean
                           },
"can_write_story":
{ Args: { "p_story": string }; Returns: boolean
                           },
"chapter_story":
{ Args: { "p_chapter": string }; Returns: string
                           },
"create_invite_link":
{ Args: { "p_story": string }; Returns: string
                           },
"create_story":
{ Args: { "p_blurb"?: string,"p_title": string,"p_visibility": Database["public"]['Enums']["story_visibility"] }; Returns: string
                           },
"delete_chapter":
{ Args: { "p_chapter": string }; Returns: undefined
                           },
"delete_story":
{ Args: { "p_story": string }; Returns: undefined
                           },
"forget_story_notifications":
{ Args: { "p_story": string,"p_user": string }; Returns: undefined
                           },
"friends_presence":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_color": string,"chapter_id": string,"chapter_title": string,"story_id": string,"story_title": string,"user_id": string,"username": string
            }[]
                           },
"heartbeat":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"invite_friend":
{ Args: { "p_story": string,"p_user": string }; Returns: undefined
                           },
"invite_link_preview":
{ Args: { "p_token": string }; Returns: {
              "inviter_username": string,"story_id": string,"story_title": string,"used": boolean
            }[]
                           },
"leave_story":
{ Args: { "p_story": string }; Returns: undefined
                           },
"live_public_stories":
{ Args: Record<PropertyKey, never>; Returns: {
              "blurb": string,"id": string,"title": string,"viewers": number,"writers": number
            }[]
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"move_chapter_to":
{ Args: { "p_after"?: string,"p_chapter": string }; Returns: undefined
                           },
"next_free_color":
{ Args: { "p_preferred": string,"p_taken": (string)[] }; Returns: string
                           },
"notify":
{ Args: { "p_detail"?: Json,"p_invite"?: string,"p_kind": Database["public"]['Enums']["notification_kind"],"p_note"?: string,"p_recipients": (string)[],"p_story": string }; Returns: undefined
                           },
"public_stories":
{ Args: Record<PropertyKey, never>; Returns: {
              "blurb": string,"edited_at": string,"id": string,"status": Database["public"]['Enums']["story_status"],"title": string,"viewers": number,"writers": number
            }[]
                           },
"remove_member":
{ Args: { "p_story": string,"p_user": string }; Returns: undefined
                           },
"reply_note":
{ Args: { "p_body": string,"p_note": string }; Returns: string
                           },
"set_member_role":
{ Args: { "p_role": Database["public"]['Enums']["member_role"],"p_story": string,"p_user": string }; Returns: undefined
                           },
"set_note_resolved":
{ Args: { "p_note": string,"p_resolved": boolean }; Returns: undefined
                           },
"set_story_color":
{ Args: { "p_color": string,"p_story": string }; Returns: undefined
                           },
"set_story_finished":
{ Args: { "p_finished": boolean,"p_story": string }; Returns: undefined
                           },
"story_colors_taken":
{ Args: { "p_story": string,"p_user": string }; Returns: (string)[]
                           },
"story_member_ids":
{ Args: { "p_story": string }; Returns: (string)[]
                           },
"story_role":
{ Args: { "p_story": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"transfer_host":
{ Args: { "p_story": string,"p_user": string }; Returns: undefined
                           },
"writer_mention_ids":
{ Args: { "p_body": string,"p_story": string }; Returns: (string)[]
                           },
"writer_mention_text":
{ Args: { "p_body": string }; Returns: string
                           }
          }
          Enums: {
            "entry_type": "character"|"place"|"item"|"lore","friendship_status": "pending"|"accepted","member_role": "writer"|"cohost"|"host","notification_kind": "invite_received"|"writer_joined"|"chapter_added"|"story_finished"|"story_deleted"|"removed"|"role_changed"|"note_reply"|"note_resolved"|"note_mention"|"chat_mention","story_status": "active"|"finished","story_visibility": "public"|"private","theme": "light"|"dark"|"system"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "entry_type": ["character", "place", "item", "lore"],"friendship_status": ["pending", "accepted"],"member_role": ["writer", "cohost", "host"],"notification_kind": ["invite_received", "writer_joined", "chapter_added", "story_finished", "story_deleted", "removed", "role_changed", "note_reply", "note_resolved", "note_mention", "chat_mention"],"story_status": ["active", "finished"],"story_visibility": ["public", "private"],"theme": ["light", "dark", "system"]
          }
        }
} as const
