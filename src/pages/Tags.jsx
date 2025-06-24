
import React, { useState, useEffect } from "react";
// import { Tag } from "@/api/entities"; // Remove old entity
import { supabase } from "@/lib/supabaseClient"; // Import Supabase client
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
      const rootTags = tags.filter(tag => !tag.parent_tag_id_base44); // Updated field name
      setExpandedTags(new Set(rootTags.map(tag => tag.id)));
    }
  }, [tags]); // Dependency array: re-run only when 'tags' changes

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true }); // Order by name for consistency

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error("Erro ao carregar tags:", error.message);
      toast({
        title: "Erro ao carregar tags",
        description: "Ocorreu um problema ao buscar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleFormSubmit = async (tagData) => {
    const isEditing = !!editingTag?.id;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user && !isEditing) throw new Error("Usuário não autenticado para criar tag.");
      // For editing, RLS will protect, user object not strictly needed for the update call itself.

      if (isEditing) {
        // Ensure parent_tag_id is renamed to parent_tag_id_base44 before sending to Supabase
        const { parent_tag_id, ...restOfTagData } = tagData;
        const dataToUpdate = {
          ...restOfTagData,
          parent_tag_id_base44: tagData.parent_tag_id_base44 !== undefined ? tagData.parent_tag_id_base44 : editingTag.parent_tag_id_base44,
        };

        const { error: updateError } = await supabase
          .from("tags")
          .update(dataToUpdate) // Use dataToUpdate
          .eq("id", editingTag.id);
        if (updateError) throw updateError;

        if (dataToUpdate.color && dataToUpdate.color !== editingTag.color) { // Use dataToUpdate
          const childrenTags = tags.filter(tag => tag.parent_tag_id_base44 === editingTag.id); // Updated field name
          if (childrenTags.length > 0) {
            const updatePromises = childrenTags.map(child =>
              supabase.from("tags").update({ color: dataToUpdate.color }).eq("id", child.id) // Use dataToUpdate
            );
            const results = await Promise.all(updatePromises);
            results.forEach(result => { if (result.error) console.error("Erro ao atualizar cor do filho:", result.error); });
            
            toast({
              title: "Cores atualizadas!",
              description: `A cor da tag "${dataToUpdate.name}" e suas ${childrenTags.length} tag(s) filha(s) foram atualizadas.`, // Use dataToUpdate
              className: "bg-blue-100 text-blue-800 border-blue-300",
            });
          } else {
             toast({
              title: "Tag Atualizada!",
              description: `A tag "${dataToUpdate.name}" foi atualizada com sucesso.`, // Use dataToUpdate
              className: "bg-green-100 text-green-800 border-green-300",
            });
          }
        } else {
           toast({
            title: "Tag Atualizada!",
            description: `A tag "${dataToUpdate.name}" foi atualizada com sucesso.`, // Use dataToUpdate
            className: "bg-green-100 text-green-800 border-green-300",
          });
        }
      } else { // Creating new tag
        // Ensure parent_tag_id is renamed to parent_tag_id_base44
        const { parent_tag_id, ...restOfTagData } = tagData;
        let finalTagData = {
          ...restOfTagData,
          parent_tag_id_base44: tagData.parent_tag_id_base44, // Use the correct field from form
          user_id: user.id
        };

        if (finalTagData.parent_tag_id_base44) { // Check renamed field
          const parentTag = tags.find(t => t.id === finalTagData.parent_tag_id_base44); // Use renamed field
          if (parentTag && parentTag.color && !finalTagData.color) {
            finalTagData.color = parentTag.color;
          }
        }
        
        const { error: insertError } = await supabase.from("tags").insert([finalTagData]);
        if (insertError) throw insertError;
        toast({
          title: "Tag Criada!",
          description: `A tag "${finalTagData.name}" foi criada com sucesso.`,
          className: "bg-green-100 text-green-800 border-green-300",
        });
      }
      setShowForm(false);
      setEditingTag(null);
      loadTags();
    } catch (error) {
      console.error("Erro ao salvar tag:", error.message);
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
    const hasChildren = tags.some(tag => tag.parent_tag_id_base44 === tagId); // Updated field name
    if (hasChildren) {
      toast({
        title: "Não é possível excluir",
        description: "Esta tag possui tags filhas. Remova ou reatribua as tags filhas primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagToDelete = tags.find(t => t.id === tagId); // For toast message
      const { error } = await supabase.from("tags").delete().eq("id", tagId);
      if (error) throw error;

      toast({
        title: "Tag Excluída!",
        description: `A tag "${tagToDelete?.name}" foi excluída com sucesso.`,
      });
      loadTags();
    } catch (error) {
      console.error("Erro ao excluir tag:", error.message);
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
    const rootTags = tags.filter(tag => !tag.parent_tag_id_base44); // Updated field name
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
      if (tag.parent_tag_id_base44 && tagMap[tag.parent_tag_id_base44]) { // Updated field name
        tagMap[tag.parent_tag_id_base44].children.push(tagMap[tag.id]); // Updated field name
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
