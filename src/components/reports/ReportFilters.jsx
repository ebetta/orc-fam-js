
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, Calendar as CalendarIcon, BarChart } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";

export default function ReportFilters({ allTags, filters, onFiltersChange, onGenerateReport, isLoading }) {
    const { toast } = useToast();

    const handleTagChange = (tagId, checked) => {
        onFiltersChange(prev => ({
            ...prev,
            selectedTags: {
                ...prev.selectedTags,
                [tagId]: checked
            }
        }));
    };
    
    const handleSelectAllTags = (select) => {
        const newSelectedTags = {};
        allTags.forEach(tag => {
            newSelectedTags[tag.id] = select;
        });
        onFiltersChange(prev => ({ ...prev, selectedTags: newSelectedTags }));
    };

    // Função para organizar tags hierarquicamente
    const organizeTagsHierarchically = (tags) => {
        if (!tags || tags.length === 0) return [];

        // Criar um mapa de tags por ID para facilitar busca
        const tagMap = {};
        tags.forEach(tag => {
            tagMap[tag.id] = { ...tag, children: [] };
        });

        // Separar tags pai (sem parent_tag_id) das filhas
        const rootTags = [];
        tags.forEach(tag => {
            if (tag.parent_tag_id && tagMap[tag.parent_tag_id]) {
                // É uma tag filha, adicionar aos children do pai
                tagMap[tag.parent_tag_id].children.push(tagMap[tag.id]);
            } else {
                // É uma tag pai ou órfã
                rootTags.push(tagMap[tag.id]);
            }
        });

        // Ordenar tags pai alfabeticamente
        rootTags.sort((a, b) => a.name.localeCompare(b.name));

        // Ordenar filhas de cada pai alfabeticamente
        rootTags.forEach(parentTag => {
            parentTag.children.sort((a, b) => a.name.localeCompare(b.name));
        });

        // Criar lista linear hierárquica para renderização
        const hierarchicalList = [];
        rootTags.forEach(parentTag => {
            hierarchicalList.push({ ...parentTag, level: 0 });
            parentTag.children.forEach(childTag => {
                hierarchicalList.push({ ...childTag, level: 1 });
            });
        });

        return hierarchicalList;
    };

    const hierarchicalTags = organizeTagsHierarchically(allTags);

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="border-b bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-700"/>
                    Filtros do Relatório
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {isLoading ? (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <Label className="font-semibold">Período</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-12 w-full justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {filters.period?.from ? (
                                        filters.period.to ? (
                                            <>{format(filters.period.from, "dd/MM/yy")} - {format(filters.period.to, "dd/MM/yy")}</>
                                        ) : (format(filters.period.from, "dd/MM/yy"))
                                    ) : ( <span>Escolha o período</span>)}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={filters.period?.from}
                                    selected={filters.period}
                                    onSelect={(range) => onFiltersChange(prev => ({...prev, period: range}))}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>

                            <Label className="font-semibold pt-4 block">Tipo de Relatório</Label>
                            <RadioGroup
                                value={filters.reportType}
                                onValueChange={(value) => onFiltersChange(prev => ({...prev, reportType: value}))}
                                className="flex gap-4 flex-wrap"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="expenses_by_tag" id="expenses_report" />
                                    <Label htmlFor="expenses_report">Despesas</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="budget" id="budget_report" />
                                    <Label htmlFor="budget_report">Orçamento</Label>
                                </div>
                            </RadioGroup>
                            
                            <Button onClick={onGenerateReport} className="w-full bg-teal-600 hover:bg-teal-700 mt-6">
                                <BarChart className="w-4 h-4 mr-2"/>
                                Gerar Relatório
                            </Button>
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="font-semibold">Tags Incluídas</Label>
                                <div className="space-x-2">
                                    <Button variant="link" size="sm" onClick={() => handleSelectAllTags(true)}>Selecionar Todas</Button>
                                    <Button variant="link" size="sm" onClick={() => handleSelectAllTags(false)}>Limpar</Button>
                                </div>
                            </div>
                            <ScrollArea className="h-48 w-full rounded-md border p-4">
                               <div className="space-y-2">
                                {hierarchicalTags.map(tag => (
                                    <div 
                                        key={tag.id} 
                                        className={`flex items-center space-x-2 ${tag.level === 1 ? 'ml-6' : ''}`}
                                    >
                                        <Checkbox
                                            id={`tag-${tag.id}`}
                                            checked={!!filters.selectedTags[tag.id]}
                                            onCheckedChange={(checked) => handleTagChange(tag.id, checked)}
                                        />
                                        <Label 
                                            htmlFor={`tag-${tag.id}`} 
                                            className={`text-sm font-normal flex items-center gap-2 ${
                                                tag.level === 0 ? 'font-medium text-gray-900' : 'text-gray-700'
                                            }`}
                                        >
                                            <span 
                                                className="w-2 h-2 rounded-full" 
                                                style={{backgroundColor: tag.color || '#ccc'}}
                                            ></span>
                                            {tag.level === 1 && '└ '}{tag.name}
                                        </Label>
                                    </div>
                                ))}
                               </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
