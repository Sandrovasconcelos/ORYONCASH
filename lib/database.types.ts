export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      obras: {
        Row: {
          id: string;
          nome: string;
          orcamento_total: number;
          data_inicio: string | null;
          status: "ativa" | "concluida";
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          orcamento_total?: number;
          data_inicio?: string | null;
          status?: "ativa" | "concluida";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
        Relationships: [];
      };
      categorias: {
        Row: { id: string; nome: string; created_at: string };
        Insert: { id?: string; nome: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Insert"]>;
        Relationships: [];
      };
      etapas: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          obra_id: string | null;
          valor_orcado: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          ordem?: number;
          obra_id?: string | null;
          valor_orcado?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["etapas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "etapas_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      materiais: {
        Row: {
          id: string;
          nome: string;
          categoria_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["materiais"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "materiais_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      fornecedores: {
        Row: {
          id: string;
          nome: string;
          contato: string | null;
          cnpj: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          contato?: string | null;
          cnpj?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["fornecedores"]["Insert"]
        >;
        Relationships: [];
      };
      despesas: {
        Row: {
          id: string;
          obra_id: string;
          categoria_id: string;
          etapa_id: string | null;
          material_id: string | null;
          fornecedor_id: string | null;
          descricao: string | null;
          valor: number;
          data: string;
          origem: "whatsapp" | "dashboard";
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          categoria_id: string;
          etapa_id?: string | null;
          material_id?: string | null;
          fornecedor_id?: string | null;
          descricao?: string | null;
          valor: number;
          data?: string;
          origem?: "whatsapp" | "dashboard";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["despesas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "despesas_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materiais";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_sessions: {
        Row: {
          telefone: string;
          estado_atual: string;
          dados_coletados: Json;
          updated_at: string;
        };
        Insert: {
          telefone: string;
          estado_atual?: string;
          dados_coletados?: Json;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["whatsapp_sessions"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
