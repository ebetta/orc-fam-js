
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Save, Tag as TagIconForm, Palette, Smile, ChevronsUpDown, Check } from "lucide-react"; // Adicionado ChevronsUpDown, Check
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Adicionado Popover
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"; // Adicionado Command

const tagTypes = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "both", label: "Ambos" }
];

const defaultColors = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF8C42", 
  "#40DFEF", "#B9E0FF", "#FFC8DD", "#A2D2FF"
];

export default function TagForm({ tag, allTags, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: tag?.name || "",
    parent_tag_id_base44: tag?.parent_tag_id_base44 || null, // Updated field name
    color: tag?.color || defaultColors[0],
    icon: tag?.icon || "",
    tag_type: tag?.tag_type || "expense",
    is_active: tag?.is_active !== false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [parentTagPopoverOpen, setParentTagPopoverOpen] = useState(false);
  const [parentTagSearchValue, setParentTagSearchValue] = useState("");

  useEffect(() => {
    const currentParentTagId = tag?.parent_tag_id_base44 || null; // Updated field name
    let initialColor = tag?.color || defaultColors[0];
    
    // Se é uma nova tag e tem pai selecionado, herdar a cor do pai
    if (!tag && currentParentTagId) {
      const parentTag = allTags.find(t => t.id === currentParentTagId);
      if (parentTag && parentTag.color) {
        initialColor = parentTag.color;
      }
    }
    
    setFormData({
      name: tag?.name || "",
      parent_tag_id_base44: currentParentTagId, // Updated field name
      color: initialColor,
      icon: tag?.icon || "",
      tag_type: tag?.tag_type || "expense",
      is_active: tag?.is_active !== false
    });

    const currentParentTag = allTags.find(t => t.id === currentParentTagId);
    // Set parentTagSearchValue to the name of the current parent tag, or empty string if none.
    // This pre-fills the search input if a parent tag is already selected when editing.
    setParentTagSearchValue(currentParentTag ? currentParentTag.name : "");

  }, [tag, allTags]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const dataToSave = { ...formData };
    // parent_tag_id_base44 is already null if not selected, or the tag ID.
    // No extra treatment needed here for 'null' string, as handleInputChange manages it.
    try {
      await onSave(dataToSave);
    } catch (error) {
      console.error("Erro ao salvar tag:", error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Se mudou a tag pai, herdar a cor do novo pai (apenas para novas tags)
      if (field === 'parent_tag_id_base44' && !tag) { // Updated field name
        if (value) {
          const parentTag = allTags.find(t => t.id === value);
          if (parentTag && parentTag.color) {
            newData.color = parentTag.color;
          }
        } else {
          // Se removeu o pai, volta para a cor padrão
          newData.color = defaultColors[0];
        }
      }
      
      return newData;
    });
  };

  // Filter available parent tags: cannot be self, and filter by search value
  const parentTagOptions = allTags
    .filter(t => t.id !== tag?.id) // Cannot be its own parent
    .filter(t => t.name.toLowerCase().includes(parentTagSearchValue.toLowerCase()));
  
  // Find the selected parent tag object for display in the combobox button
  const selectedParentTag = allTags.find(t => t.id === formData.parent_tag_id_base44); // Updated field name

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TagIconForm className="w-6 h-6 text-purple-600" /> {/* Usar TagIconForm aqui */}
            </div>
            {tag ? "Editar Tag" : "Nova Tag"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nome da Tag *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ex: Alimentação, Supermercado"
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_tag_id_combobox" className="text-sm font-medium">
                Tag Pai (Opcional)
              </Label>
              <Popover open={parentTagPopoverOpen} onOpenChange={setParentTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={parentTagPopoverOpen}
                    className="w-full justify-between h-12 font-normal"
                    id="parent_tag_id_combobox"
                  >
                    {selectedParentTag ? selectedParentTag.name : "Nenhuma tag pai"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar tag pai..."
                      value={parentTagSearchValue}
                      onValueChange={setParentTagSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="no-parent-tag"
                          value="Nenhuma tag pai" // Value for CommandInput filter and onSelect
                          onSelect={() => {
                            handleInputChange("parent_tag_id_base44", null); // Updated field name
                            setParentTagSearchValue(""); // Clear search value
                            setParentTagPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${!formData.parent_tag_id_base44 ? "opacity-100" : "opacity-0"}`} // Updated field name
                          />
                          Nenhuma tag pai
                        </CommandItem>
                        {parentTagOptions.map((option) => (
                          <CommandItem
                            key={option.id}
                            value={option.name} // Value for CommandInput filter and onSelect
                            onSelect={(currentValue) => {
                              // Find the actual tag object by its name to get the ID
                              const actualSelectedTag = parentTagOptions.find(
                                t => t.name.toLowerCase() === currentValue.toLowerCase()
                              );
                              handleInputChange("parent_tag_id_base44", actualSelectedTag ? actualSelectedTag.id : null); // Updated field name
                              setParentTagSearchValue(actualSelectedTag ? actualSelectedTag.name : ""); // Set search value to selected tag's name
                              setParentTagPopoverOpen(false); // Close popover
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${formData.parent_tag_id_base44 === option.id ? "opacity-100" : "opacity-0"}`} // Updated field name
                            />
                            {option.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color" className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4" /> Cor
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  className="h-12 w-16 p-1"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => handleInputChange("color", e.target.value)}
                  placeholder="#RRGGBB"
                  className="h-12 flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon" className="text-sm font-medium flex items-center gap-2">
                 <Smile className="w-4 h-4" /> Ícone (Lucide)
              </Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => handleInputChange("icon", e.target.value)}
                placeholder="Ex: home, car, shopping-cart"
                className="h-12"
              />
               <p className="text-xs text-gray-500">
                Use nomes de ícones da <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Lucide Icons</a>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag_type" className="text-sm font-medium">
                Tipo de Transação *
              </Label>
              <Select
                value={formData.tag_type}
                onValueChange={(value) => handleInputChange("tag_type", value)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tagTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="is_active" className="text-sm font-medium">
                Tag Ativa
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Tags inativas não aparecerão nas seleções de transação.
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange("is_active", checked)}
            />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="h-12 px-8"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 px-8 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {tag ? "Atualizar" : "Criar"} Tag
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
