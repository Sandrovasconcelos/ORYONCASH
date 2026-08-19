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
          categoria_medicao_padrao_id: string | null;
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
          categoria_medicao_padrao_id?: string | null;
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
          usa_etapa: boolean;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          usa_etapa?: boolean;
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
          fornecedor_id: string | null;
          situacao_qualidade: string;
          checklist_template_id: string | null;
          data_inicio_prevista: string | null;
          data_fim_prevista: string | null;
          percentual_executado: number;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          ordem?: number;
          obra_id?: string | null;
          valor_orcado?: number | null;
          fornecedor_id?: string | null;
          situacao_qualidade?: string;
          checklist_template_id?: string | null;
          data_inicio_prevista?: string | null;
          data_fim_prevista?: string | null;
          percentual_executado?: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
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
          {
            foreignKeyName: "etapas_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "etapas_checklist_template_id_fkey";
            columns: ["checklist_template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      etapa_distribuicao_mensal: {
        Row: {
          id: string;
          etapa_id: string;
          mes: string;
          percentual: number;
          duracao_dias: number;
          observacao: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          etapa_id: string;
          mes: string;
          percentual?: number;
          duracao_dias?: number;
          observacao?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["etapa_distribuicao_mensal"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "etapa_distribuicao_mensal_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
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
          conta_bancaria_id: string | null;
          descricao: string | null;
          valor: number;
          quantidade: number | null;
          valor_unitario: number | null;
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
          conta_bancaria_id?: string | null;
          descricao?: string | null;
          valor: number;
          quantidade?: number | null;
          valor_unitario?: number | null;
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
          {
            foreignKeyName: "despesas_conta_bancaria_id_fkey";
            columns: ["conta_bancaria_id"];
            isOneToOne: false;
            referencedRelation: "contas_bancarias";
            referencedColumns: ["id"];
          },
        ];
      };
      contas_bancarias: {
        Row: {
          id: string;
          nome: string;
          banco: string | null;
          agencia: string | null;
          numero: string | null;
          titular: string | null;
          documento: string | null;
          saldo_inicial: number;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          banco?: string | null;
          agencia?: string | null;
          numero?: string | null;
          titular?: string | null;
          documento?: string | null;
          saldo_inicial?: number;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["contas_bancarias"]["Insert"]
        >;
        Relationships: [];
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
      whatsapp_mensagens_processadas: {
        Row: {
          wamid: string;
          created_at: string;
        };
        Insert: {
          wamid: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["whatsapp_mensagens_processadas"]["Insert"]
        >;
        Relationships: [];
      };
      configuracoes_notificacao: {
        Row: {
          id: boolean;
          numero_whatsapp: string | null;
          notificar_atraso: boolean;
          notificar_estouro: boolean;
          notificar_saldo_negativo: boolean;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          numero_whatsapp?: string | null;
          notificar_atraso?: boolean;
          notificar_estouro?: boolean;
          notificar_saldo_negativo?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["configuracoes_notificacao"]["Insert"]>;
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
            | "usuario_whatsapp"
            | "medicao"
            | "contrato_fornecedor"
            | "cronograma_template"
            | "checklist_template"
            | "conta_bancaria"
            | "etapa";
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
            | "usuario_whatsapp"
            | "medicao"
            | "contrato_fornecedor"
            | "cronograma_template"
            | "checklist_template"
            | "conta_bancaria"
            | "etapa";
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
      checklist_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["checklist_templates"]["Insert"]
        >;
        Relationships: [];
      };
      checklist_itens: {
        Row: {
          id: string;
          template_id: string;
          descricao: string;
          critico: boolean;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          descricao: string;
          critico?: boolean;
          ordem?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checklist_itens"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "checklist_itens_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      inspecoes: {
        Row: {
          id: string;
          etapa_id: string;
          template_id: string | null;
          resultado: "aprovado" | "pendente" | "reprovado";
          observacao: string | null;
          inspecionado_por: string | null;
          origem: "dashboard";
          created_at: string;
        };
        Insert: {
          id?: string;
          etapa_id: string;
          template_id?: string | null;
          resultado: "aprovado" | "pendente" | "reprovado";
          observacao?: string | null;
          inspecionado_por?: string | null;
          origem?: "dashboard";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inspecoes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inspecoes_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspecoes_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      inspecao_respostas: {
        Row: {
          id: string;
          inspecao_id: string;
          checklist_item_id: string;
          resposta: "aprovado" | "pendente" | "reprovado" | "nao_aplica";
          created_at: string;
        };
        Insert: {
          id?: string;
          inspecao_id: string;
          checklist_item_id: string;
          resposta: "aprovado" | "pendente" | "reprovado" | "nao_aplica";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["inspecao_respostas"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "inspecao_respostas_inspecao_id_fkey";
            columns: ["inspecao_id"];
            isOneToOne: false;
            referencedRelation: "inspecoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspecao_respostas_checklist_item_id_fkey";
            columns: ["checklist_item_id"];
            isOneToOne: false;
            referencedRelation: "checklist_itens";
            referencedColumns: ["id"];
          },
        ];
      };
      inspecao_evidencias: {
        Row: {
          id: string;
          inspecao_id: string;
          storage_bucket: string;
          storage_path: string;
          mime_type: string;
          nome_arquivo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inspecao_id: string;
          storage_bucket?: string;
          storage_path: string;
          mime_type: string;
          nome_arquivo?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["inspecao_evidencias"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "inspecao_evidencias_inspecao_id_fkey";
            columns: ["inspecao_id"];
            isOneToOne: false;
            referencedRelation: "inspecoes";
            referencedColumns: ["id"];
          },
        ];
      };
      medicoes: {
        Row: {
          id: string;
          obra_id: string;
          categoria_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          status: "preparada" | "aprovada" | "paga";
          valor_total: number;
          observacao: string | null;
          criado_por: string | null;
          aprovado_por: string | null;
          aprovado_em: string | null;
          pago_em: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          obra_id: string;
          categoria_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          status?: "preparada" | "aprovada" | "paga";
          valor_total?: number;
          observacao?: string | null;
          criado_por?: string | null;
          aprovado_por?: string | null;
          aprovado_em?: string | null;
          pago_em?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["medicoes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "medicoes_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medicoes_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      medicao_itens: {
        Row: {
          id: string;
          medicao_id: string;
          etapa_id: string;
          fornecedor_id: string | null;
          percentual_medido: number;
          valor_medido: number;
          despesa_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          medicao_id: string;
          etapa_id: string;
          fornecedor_id?: string | null;
          percentual_medido: number;
          valor_medido: number;
          despesa_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["medicao_itens"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "medicao_itens_medicao_id_fkey";
            columns: ["medicao_id"];
            isOneToOne: false;
            referencedRelation: "medicoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medicao_itens_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medicao_itens_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medicao_itens_despesa_id_fkey";
            columns: ["despesa_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
        ];
      };
      cronograma_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["cronograma_templates"]["Insert"]
        >;
        Relationships: [];
      };
      cronograma_template_fases: {
        Row: {
          id: string;
          template_id: string;
          nome: string;
          ordem: number;
          mes_inicio: number;
          duracao_meses: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          nome: string;
          ordem?: number;
          mes_inicio?: number;
          duracao_meses?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["cronograma_template_fases"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "cronograma_template_fases_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "cronograma_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      cronograma_template_atividades: {
        Row: {
          id: string;
          fase_id: string;
          descricao: string;
          ordem: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          fase_id: string;
          descricao: string;
          ordem?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["cronograma_template_atividades"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "cronograma_template_atividades_fase_id_fkey";
            columns: ["fase_id"];
            isOneToOne: false;
            referencedRelation: "cronograma_template_fases";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronograma_fases: {
        Row: {
          id: string;
          obra_id: string;
          nome: string;
          ordem: number;
          data_inicio_prevista: string;
          data_fim_prevista: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          obra_id: string;
          nome: string;
          ordem?: number;
          data_inicio_prevista: string;
          data_fim_prevista: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["obra_cronograma_fases"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_fases_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_cronograma_atividades: {
        Row: {
          id: string;
          fase_id: string;
          etapa_id: string | null;
          descricao: string;
          ordem: number;
          status: "a_fazer" | "em_andamento" | "concluida";
          concluida_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fase_id: string;
          etapa_id?: string | null;
          descricao: string;
          ordem?: number;
          status?: "a_fazer" | "em_andamento" | "concluida";
          concluida_em?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["obra_cronograma_atividades"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "obra_cronograma_atividades_fase_id_fkey";
            columns: ["fase_id"];
            isOneToOne: false;
            referencedRelation: "obra_cronograma_fases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_cronograma_atividades_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      contratos_fornecedor: {
        Row: {
          id: string;
          obra_id: string;
          fornecedor_id: string;
          etapa_id: string | null;
          descricao: string | null;
          valor_contrato: number;
          arquivo_storage_path: string | null;
          arquivo_nome: string | null;
          arquivo_mime_type: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
        };
        Insert: {
          id?: string;
          obra_id: string;
          fornecedor_id: string;
          etapa_id?: string | null;
          descricao?: string | null;
          valor_contrato?: number;
          arquivo_storage_path?: string | null;
          arquivo_nome?: string | null;
          arquivo_mime_type?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["contratos_fornecedor"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "contratos_fornecedor_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contratos_fornecedor_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contratos_fornecedor_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
