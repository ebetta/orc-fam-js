
import React, { useState, useEffect } from "react";
import { Tag } from "@/api/entities";
import { motion } from "framer-motion";

import TagsHeader from "../components/tags/TagsHeader";
import TagForm from "../components/tags/TagForm";
import TagsList from "../components/tags/TagsList";
import { useToast } from "@/components/ui/use-toast";

export default function TagsPage() {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [expandedTags, setExpandedTags] = useState(new Set()); // New state for expanded tags
  const { toast } = useToast();

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    // Auto-expandir todas as tags quando carregadas inicialmente
    // This effect runs whenever 'tags' state changes.
    // It checks if 'expandedTags' is currently empty (e.g., on initial load or if manually collapsed all)
    // and if there are tags available, it expands only the root-level tags.
    if (tags.length > 0 && expandedTags.size === 0) {
      const rootTags = tags.filter(tag => !tag.parent_tag_id);
      setExpandedTags(new Set(rootTags.map(tag => tag.id)));
    }
  }, [tags]); // Dependency array: re-run only when 'tags' changes

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const data = await Tag.list(); // Fetching without specific order, as we'll sort client-side.
      setTags(data);
    } catch (error) {
      console.error("Erro ao carregar tags:", error);
      toast({
        title: "Erro ao carregar tags",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleFormSubmit = async (tagData) => {
    // A verificação se é uma edição agora depende da existência do 'id' no objeto.
    const isEditing = !!editingTag?.id;

    try {
      if (isEditing) {
        await Tag.update(editingTag.id, tagData);
        
        // Se a tag editada é uma tag pai e a cor foi alterada, atualizar cor dos filhos
        if (tagData.color && tagData.color !== editingTag.color) {
          const childrenTags = tags.filter(tag => tag.parent_tag_id === editingTag.id);
          
          if (childrenTags.length > 0) {
            // Atualizar cor de todos os filhos
            const updatePromises = childrenTags.map(child => 
              Tag.update(child.id, { ...child, color: tagData.color })
            );
            
            await Promise.all(updatePromises);
            
            toast({
              title: "Cores atualizadas!",
              description: `A cor da tag "${tagData.name}" e suas ${childrenTags.length} tag(s) filha(s) foram atualizadas.`,
              className: "bg-blue-100 text-blue-800 border-blue-300",
            });
          } else {
            toast({
              title: "Tag Atualizada!",
              description: `A tag "${tagData.name}" foi atualizada com sucesso.`,
              className: "bg-green-100 text-green-800 border-green-300",
            });
          }
        } else {
          toast({
            title: "Tag Atualizada!",
            description: `A tag "${tagData.name}" foi atualizada com sucesso.`,
            className: "bg-green-100 text-green-800 border-green-300",
          });
        }
      } else {
        // Se é uma nova tag filha, herdar a cor do pai
        let finalTagData = { ...tagData };
        
        if (tagData.parent_tag_id) {
          const parentTag = tags.find(t => t.id === tagData.parent_tag_id);
          if (parentTag && parentTag.color && !tagData.color) {
            finalTagData.color = parentTag.color;
          }
        }
        
        await Tag.create(finalTagData);
        toast({
          title: "Tag Criada!",
          description: `A tag "${tagData.name}" foi criada com sucesso.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      }
      setShowForm(false);
      setEditingTag(null);
      loadTags();
    } catch (error) {
      console.error("Erro ao salvar tag:", error);
      toast({
        title: "Erro ao salvar tag",
        description: "Não foi possível salvar a tag. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setShowForm(true);
  };

  const handleDeleteTag = async (tagId) => {
    // Verificar se a tag tem filhas
    const hasChildren = tags.some(tag => tag.parent_tag_id === tagId);
    if (hasChildren) {
      toast({
        title: "Não é possível excluir",
        description: "Esta tag possui tags filhas. Remova ou reatribua as tags filhas primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagToDelete = tags.find(t => t.id === tagId);
      await Tag.delete(tagId);
      toast({
        title: "Tag Excluída!",
        description: `A tag "${tagToDelete?.name}" foi excluída com sucesso.`,
      });
      loadTags();
    } catch (error) {
      console.error("Erro ao excluir tag:", error);
      toast({
        title: "Erro ao excluir tag",
        description: "Ocorreu um problema ao tentar excluir a tag.",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTag(null);
  };
  
  // New functions for expand/collapse controls
  const handleToggleTag = (tagId) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    // Expands only root-level tags as per outline
    const rootTags = tags.filter(tag => !tag.parent_tag_id);
    setExpandedTags(new Set(rootTags.map(tag => tag.id)));
  };

  const handleCollapseAll = () => {
    setExpandedTags(new Set()); // Clears the set, collapsing all
  };

  // Estruturar tags em árvore para passar para TagsList
  const buildTagTree = (tagsList) => {
    if (!tagsList || tagsList.length === 0) return [];

    const tagMap = {};
    const tree = [];

    tagsList.forEach(tag => {
      tagMap[tag.id] = { ...tag, children: [] };
    });

    tagsList.forEach(tag => {
      if (tag.parent_tag_id && tagMap[tag.parent_tag_id]) {
        tagMap[tag.parent_tag_id].children.push(tagMap[tag.id]);
      } else {
        tree.push(tagMap[tag.id]);
      }
    });

    // Helper function to sort children recursively
    const sortChildren = (node) => {
      if (node.children && node.children.length > 0) {
        // Sort children of the current node alphabetically
        node.children.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        // Recursively sort the children of these children
        node.children.forEach(sortChildren);
      }
    };
    
    // Sort the root-level tags alphabetically
    tree.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    
    // Sort the children of each root-level tag
    tree.forEach(sortChildren);

    return tree;
  };
  
  const tagTree = buildTagTree(tags);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TagsHeader
          onAddTag={() => { setEditingTag(null); setShowForm(true); }}
          tagsCount={tags.length}
          onExpandAll={handleExpandAll}   // Pass new expand all handler
          onCollapseAll={handleCollapseAll} // Pass new collapse all handler
        />
      </motion.div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <TagForm
            tag={editingTag}
            allTags={tags} // Passar todas as tags para o seletor de tag pai
            onSave={handleFormSubmit}
            onCancel={handleCancelForm}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: showForm ? 0 : 0.2 }}
      >
        <TagsList
          tags={tagTree} // Usar a árvore de tags
          isLoading={isLoading}
          onEditTag={handleEditTag}
          onDeleteTag={handleDeleteTag}
          expandedTags={expandedTags} // Pass the set of expanded tag IDs
          onToggleTag={handleToggleTag} // Pass the handler for individual tag toggling
        />
      </motion.div>
    </div>
  );
}
