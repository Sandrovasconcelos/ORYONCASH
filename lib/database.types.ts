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
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          orcamento_total?: number;
          data_inicio?: string | null;
          status?: "ativa" | "concluida";
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["obras"]["Insert"]>;
        Relationships: [];
      };
      categorias: {
        Row: {
          id: string;
          nome: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
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
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
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
          cpf: string | null;
          chave_pix: string | null;
          conta_banco: string | null;
          conta_agencia: string | null;
          conta_numero: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          contato?: string | null;
          cnpj?: string | null;
          cpf?: string | null;
          chave_pix?: string | null;
          conta_banco?: string | null;
          conta_agencia?: string | null;
          conta_numero?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
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
          criado_por_telefone: string | null;
          criado_por_nome: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
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
          criado_por_telefone?: string | null;
          criado_por_nome?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
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
      despesa_comprovantes: {
        Row: {
          id: string;
          despesa_id: string | null;
          tipo_documento: "documento_cobranca" | "comprovante_pagamento" | "outro";
          whatsapp_media_id: string | null;
          storage_bucket: string;
          storage_path: string;
          mime_type: string;
          nome_arquivo: string | null;
          conta_origem_banco: string | null;
          conta_origem_titular: string | null;
          conta_origem_documento: string | null;
          conta_origem_agencia: string | null;
          conta_origem_numero: string | null;
          metodo_pagamento: string | null;
          numero_documento: string | null;
          origem: "whatsapp" | "dashboard";
          created_at: string;
        };
        Insert: {
          id?: string;
          despesa_id?: string | null;
          tipo_documento?: "documento_cobranca" | "comprovante_pagamento" | "outro";
          whatsapp_media_id?: string | null;
          storage_bucket?: string;
          storage_path: string;
          mime_type: string;
          nome_arquivo?: string | null;
          numero_documento?: string | null;
          conta_origem_banco?: string | null;
          conta_origem_titular?: string | null;
          conta_origem_documento?: string | null;
          conta_origem_agencia?: string | null;
          conta_origem_numero?: string | null;
          metodo_pagamento?: string | null;
          origem?: "whatsapp" | "dashboard";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["despesa_comprovantes"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "despesa_comprovantes_despesa_id_fkey";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
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
      usuarios_whatsapp: {
        Row: {
          telefone: string;
          nome: string;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          telefone: string;
          nome: string;
          ativo?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["usuarios_whatsapp"]["Insert"]
        >;
        Relationships: [];
      };
      atividades: {
        Row: {
          id: string;
          tipo: "criacao" | "edicao" | "exclusao";
          entidade:
            | "despesa"
            | "obra"
            | "categoria"
            | "material"
            | "fornecedor"
            | "orcamento"
            | "usuario_whatsapp";
          entidade_id: string | null;
          origem: "whatsapp" | "dashboard";
          autor_telefone: string | null;
          autor_nome: string | null;
          resumo: string;
          dados_antes: Json | null;
          dados_depois: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: "criacao" | "edicao" | "exclusao";
          entidade:
            | "despesa"
            | "obra"
            | "categoria"
            | "material"
            | "fornecedor"
            | "orcamento"
            | "usuario_whatsapp";
          entidade_id?: string | null;
          origem: "whatsapp" | "dashboard";
          autor_telefone?: string | null;
          autor_nome?: string | null;
          resumo: string;
          dados_antes?: Json | null;
          dados_depois?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["atividades"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
